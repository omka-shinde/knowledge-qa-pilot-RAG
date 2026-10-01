import {
  buildSearchableContent,
  normalizeQuestionKey,
  normalizeWhitespace,
} from "@/services/ingestion/normalizer";
import type {
  InvalidKnowledgeRecord,
  ParsedKnowledgeRecord,
  ValidatedKnowledgeRecord,
} from "@/services/ingestion/types";

export type ValidationResult = {
  valid: ValidatedKnowledgeRecord[];
  invalid: InvalidKnowledgeRecord[];
  duplicates: ValidatedKnowledgeRecord[];
};

/**
 * Validate parsed records and split duplicates by normalized question key.
 */
export function validateKnowledgeRecords(
  records: ParsedKnowledgeRecord[],
): ValidationResult {
  const valid: ValidatedKnowledgeRecord[] = [];
  const invalid: InvalidKnowledgeRecord[] = [];
  const duplicates: ValidatedKnowledgeRecord[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    const question = normalizeWhitespace(record.question);
    const answer = normalizeWhitespace(record.answer);

    if (!question) {
      invalid.push({
        reason: "Question is empty after normalization.",
        question: record.question,
        answer: record.answer,
        sourceDocument: record.sourceDocument,
        sourcePage: record.sourcePage,
      });
      continue;
    }

    if (!answer) {
      invalid.push({
        reason: "Answer is empty after normalization.",
        question,
        answer: record.answer,
        sourceDocument: record.sourceDocument,
        sourcePage: record.sourcePage,
      });
      continue;
    }

    if (!record.sourceDocument.trim()) {
      invalid.push({
        reason: "Source document is missing.",
        question,
        answer,
        sourceDocument: record.sourceDocument,
        sourcePage: record.sourcePage,
      });
      continue;
    }

    if (
      record.sourcePage !== null &&
      (!Number.isInteger(record.sourcePage) || record.sourcePage < 1)
    ) {
      invalid.push({
        reason: "Source page must be a positive integer when provided.",
        question,
        answer,
        sourceDocument: record.sourceDocument,
        sourcePage: record.sourcePage,
      });
      continue;
    }

    const questionNormalized = normalizeQuestionKey(question);
    if (!questionNormalized) {
      invalid.push({
        reason: "Question could not be normalized for deduplication.",
        question,
        answer,
        sourceDocument: record.sourceDocument,
        sourcePage: record.sourcePage,
      });
      continue;
    }

    const validated: ValidatedKnowledgeRecord = {
      question,
      answer,
      category: record.category
        ? normalizeWhitespace(record.category)
        : null,
      sourceDocument: record.sourceDocument,
      sourcePage: record.sourcePage,
      searchableContent: buildSearchableContent(question, answer),
      questionNormalized,
    };

    if (seen.has(questionNormalized)) {
      duplicates.push(validated);
      continue;
    }

    seen.add(questionNormalized);
    valid.push(validated);
  }

  return { valid, invalid, duplicates };
}
