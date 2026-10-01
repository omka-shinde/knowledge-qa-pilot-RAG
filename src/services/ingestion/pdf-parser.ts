import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import {
  isNoiseLine,
  matchSectionHeading,
  normalizeWhitespace,
} from "@/services/ingestion/normalizer";
import type {
  ParsedKnowledgeRecord,
  ParseIssue,
  PdfParseResult,
} from "@/services/ingestion/types";

type AnnotatedLine = {
  text: string;
  page: number;
};

/**
 * Lines that typically begin a FAQ question in the NRCP English FAQ PDF.
 * Compound questions may contain additional "?" mid-text; we only split on
 * question starts at the beginning of a cleaned line.
 */
const QUESTION_START =
  /^(Has|Have|How|What|When|Where|Why|Which|Who|Is|Are|Can|Could|Should|Do|Does|Did|Will|Would|Tell|We have|I am|I have)\b/i;

function isQuestionStart(line: string): boolean {
  return QUESTION_START.test(line.trim());
}

/**
 * True when the accumulated question text is complete.
 * Handles:
 * - normal "?" terminators
 * - OCR/subscript digits after "?" (e.g. "ZnSO )? 4")
 * - rare period-terminated prompts ("Tell me ... soils.")
 */
function isCompleteQuestion(accumulatedLines: string[]): boolean {
  const combined = normalizeWhitespace(accumulatedLines.join(" "));
  if (!combined) {
    return false;
  }

  const withoutTrailingSubscript = combined.replace(/\s+\d+\s*$/g, "").trim();

  if (/[?？]\s*$/.test(withoutTrailingSubscript)) {
    return true;
  }

  // Observed in the FAQ PDF: one prompt ends with "." instead of "?"
  if (/^Tell me\b/i.test(combined) && /\.\s*$/.test(withoutTrailingSubscript)) {
    return true;
  }

  return false;
}

function cleanQuestionText(accumulatedLines: string[]): string {
  return normalizeWhitespace(
    accumulatedLines.join(" ").replace(/\s+\d+\s*$/g, ""),
  );
}

/**
 * Extract page-annotated lines from a PDF, stripping layout noise.
 */
export async function extractAnnotatedLines(
  filePath: string,
): Promise<{
  sourceDocument: string;
  pageCount: number;
  lines: AnnotatedLine[];
  issues: ParseIssue[];
}> {
  const sourceDocument = path.basename(filePath);
  const issues: ParseIssue[] = [];
  const absolutePath = path.resolve(filePath);

  let data: Uint8Array;
  try {
    data = new Uint8Array(await fs.readFile(absolutePath));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to read PDF file.";
    throw new Error(`Failed to read PDF "${sourceDocument}": ${message}`);
  }

  const parser = new PDFParse({ data });
  let textResult;
  try {
    textResult = await parser.getText();
  } finally {
    await parser.destroy();
  }

  if (textResult.total === 0) {
    issues.push({
      message: "PDF reports zero pages.",
      sourceDocument,
    });
  }

  const lines: AnnotatedLine[] = [];

  for (const page of textResult.pages) {
    const pageText = page.text ?? "";
    if (!pageText.trim()) {
      issues.push({
        message: "Page has no extractable text (possible scanned/image page).",
        sourceDocument,
        sourcePage: page.num,
      });
      continue;
    }

    for (const rawLine of pageText.split(/\r?\n/)) {
      const trimmed = rawLine.trim();
      if (isNoiseLine(trimmed)) {
        continue;
      }
      lines.push({ text: trimmed, page: page.num });
    }
  }

  return {
    sourceDocument,
    pageCount: textResult.total,
    lines,
    issues,
  };
}

/**
 * Parse FAQ-style Q&A pairs from annotated lines.
 * Independent of PostgreSQL — returns structured records only.
 */
export function parseAnnotatedLines(
  sourceDocument: string,
  lines: AnnotatedLine[],
): { records: ParsedKnowledgeRecord[]; issues: ParseIssue[] } {
  const records: ParsedKnowledgeRecord[] = [];
  const issues: ParseIssue[] = [];
  const unassignedSnips: ParseIssue[] = [];

  let category: string | null = null;
  let currentQuestion: string[] = [];
  let currentAnswer: string[] = [];
  let questionPage: number | null = null;
  let mode: "idle" | "question" | "answer" = "idle";

  function flush() {
    if (currentQuestion.length === 0 && currentAnswer.length === 0) {
      return;
    }

    const question = cleanQuestionText(currentQuestion);
    const answer = normalizeWhitespace(currentAnswer.join(" "));

    records.push({
      question,
      answer,
      category,
      sourceDocument,
      sourcePage: questionPage,
    });

    currentQuestion = [];
    currentAnswer = [];
    questionPage = null;
    mode = "idle";
  }

  for (const line of lines) {
    const section = matchSectionHeading(line.text);
    if (section) {
      category = section;
      continue;
    }

    if (isQuestionStart(line.text) && (mode === "idle" || mode === "answer")) {
      flush();
      mode = "question";
      questionPage = line.page;
      currentQuestion = [line.text];
      if (isCompleteQuestion(currentQuestion)) {
        mode = "answer";
      }
      continue;
    }

    if (mode === "question") {
      // Continuations may look like question-starts ("should I do to?") — keep appending
      // until the accumulated question is complete.
      currentQuestion.push(line.text);
      if (isCompleteQuestion(currentQuestion)) {
        mode = "answer";
      }
      continue;
    }

    if (mode === "answer") {
      if (isQuestionStart(line.text)) {
        flush();
        mode = "question";
        questionPage = line.page;
        currentQuestion = [line.text];
        if (isCompleteQuestion(currentQuestion)) {
          mode = "answer";
        }
        continue;
      }
      currentAnswer.push(line.text);
      continue;
    }

    unassignedSnips.push({
      message: `Unassigned text before/outside a Q&A pair: "${line.text.slice(0, 80)}"`,
      sourceDocument,
      sourcePage: line.page,
    });
  }

  flush();

  // Non-FAQ documents (e.g. Pilot project.pdf): collapse noise into one clear issue.
  if (records.length === 0 && unassignedSnips.length > 0) {
    issues.push({
      message:
        "No FAQ-style Q&A pairs detected. This PDF does not appear to be a knowledge-base FAQ source.",
      sourceDocument,
      sourcePage: unassignedSnips[0]?.sourcePage ?? null,
    });
  } else {
    issues.push(...unassignedSnips);
  }

  return { records, issues };
}

/**
 * Full PDF → structured knowledge records (no database I/O).
 */
export async function parsePdf(filePath: string): Promise<PdfParseResult> {
  const extracted = await extractAnnotatedLines(filePath);
  const parsed = parseAnnotatedLines(extracted.sourceDocument, extracted.lines);

  return {
    sourceDocument: extracted.sourceDocument,
    pageCount: extracted.pageCount,
    records: parsed.records,
    issues: [...extracted.issues, ...parsed.issues],
  };
}

export async function parsePdfs(filePaths: string[]): Promise<PdfParseResult[]> {
  const results: PdfParseResult[] = [];
  for (const filePath of filePaths) {
    results.push(await parsePdf(filePath));
  }
  return results;
}
