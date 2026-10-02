/**
 * Suggested chat questions derived from an uploaded document.
 * Prefers questions that already appear in the text. If the file has none,
 * Haiku drafts a few that are answerable from the excerpts.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documentChunks, documents, type DocumentStatus } from "@/lib/db/schema";
import { getAnthropicApiKeyOptional, getHaikuModel } from "@/lib/env";
import { createAnthropicClient } from "@/services/ai/anthropic";

const MAX_SUGGESTIONS = 4;
const PROCESSING: DocumentStatus[] = [
  "uploaded",
  "extracting",
  "chunking",
  "embedding",
];

const suggestionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["questions"],
} as const;

const SUGGESTION_SYSTEM_PROMPT = `You write short questions a person could ask about a document.

Rules:
- Use only the provided excerpts. Do not invent topics that are not in them.
- Write exactly 4 questions.
- Each question must be a single sentence ending with a question mark.
- Do not include answers, numbering, or markdown.`;

export type SuggestionStatus = "ready" | "processing" | "empty";

export type UserSuggestions = {
  questions: string[];
  filename: string | null;
  status: SuggestionStatus;
};

const QUESTION_WORD =
  "(?:what|why|how|when|where|who|which|is|are|can|does|do|has|have|should|will|did|was|were|could|would)";

function isolateQuestion(raw: string): string {
  const lead = raw
    .replace(/^(?:q(?:uestion)?\s*\d*[:.)-]\s*|\d+[.)]\s*)/i, "")
    .trim();
  if (new RegExp(`^${QUESTION_WORD}\\b`, "i").test(lead)) {
    return lead;
  }
  const match = lead.match(
    new RegExp(`(?:^|\\s)(${QUESTION_WORD}\\b.+)$`, "i"),
  );
  return (match?.[1] ?? lead).trim();
}

function cleanQuestion(raw: string): string | null {
  const question = isolateQuestion(raw.replace(/\s+/g, " ").trim());
  if (!new RegExp(`^${QUESTION_WORD}\\b`, "i").test(question)) {
    return null;
  }
  if (!question.endsWith("?")) {
    return null;
  }
  if (question.length < 15 || question.length > 180) {
    return null;
  }
  const letters = question.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 8) {
    return null;
  }
  return question.charAt(0).toUpperCase() + question.slice(1);
}

/** Pull question sentences out of document text, in the order they appear. */
export function extractQuestionsFromText(text: string): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) {
    return [];
  }

  const parts = flat.split("?");
  const questions: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < parts.length - 1; i++) {
    const tail = parts[i]?.split(/(?<=[.!])\s+/).pop() ?? "";
    const cleaned = cleanQuestion(`${tail.trim()}?`);
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    questions.push(cleaned);
  }

  return questions;
}

/** Spread picks across the document so suggestions are not all from the opening. */
export function pickEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) {
    return items.slice();
  }
  const picked: T[] = [];
  const step = (items.length - 1) / (count - 1);
  for (let i = 0; i < count; i++) {
    picked.push(items[Math.round(i * step)]!);
  }
  return picked;
}

function normalizeModelQuestions(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("questions" in value)) {
    return [];
  }
  const raw = (value as { questions?: unknown }).questions;
  if (!Array.isArray(raw)) {
    return [];
  }

  const questions: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") {
      continue;
    }
    const withMark = item.trim().endsWith("?") ? item.trim() : `${item.trim()}?`;
    const cleaned = cleanQuestion(withMark);
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    questions.push(cleaned);
    if (questions.length >= MAX_SUGGESTIONS) {
      break;
    }
  }
  return questions;
}

function excerptFromChunks(contents: string[]): string {
  if (contents.length === 0) {
    return "";
  }
  const indexes = new Set<number>([0, contents.length - 1]);
  if (contents.length > 2) {
    indexes.add(Math.floor(contents.length / 2));
  }
  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => contents[index]?.slice(0, 1800) ?? "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);
}

async function draftQuestions(
  excerpt: string,
  client?: Anthropic,
): Promise<string[]> {
  const apiKey = getAnthropicApiKeyOptional();
  if (!client && !apiKey) {
    return [];
  }

  const anthropic = client ?? createAnthropicClient(apiKey as string);
  const message = await anthropic.messages.parse({
    model: getHaikuModel(),
    max_tokens: 400,
    system: SUGGESTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Document excerpts:\n\n${excerpt}`,
      },
    ],
    output_config: {
      format: jsonSchemaOutputFormat(suggestionSchema),
    },
  });

  return normalizeModelQuestions(message.parsed_output);
}

const inflight = new Map<string, Promise<string[]>>();

async function generateAndStore(documentId: string): Promise<string[]> {
  const db = getDb();
  const chunks = await db
    .select({
      content: documentChunks.content,
      chunkIndex: documentChunks.chunkIndex,
    })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .orderBy(asc(documentChunks.chunkIndex));

  const contents = chunks.map((chunk) => chunk.content);
  const extracted = pickEvenly(
    extractQuestionsFromText(contents.join("\n")),
    MAX_SUGGESTIONS,
  );

  let questions = extracted;
  if (questions.length === 0 && contents.length > 0) {
    questions = await draftQuestions(excerptFromChunks(contents));
  }

  await db
    .update(documents)
    .set({
      suggestedQuestions: questions,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  return questions;
}

/** Build and persist suggestions for one document. Concurrent calls share one run. */
export function generateAndStoreSuggestions(
  documentId: string,
): Promise<string[]> {
  const existing = inflight.get(documentId);
  if (existing) {
    return existing;
  }
  const job = generateAndStore(documentId).finally(() => {
    inflight.delete(documentId);
  });
  inflight.set(documentId, job);
  return job;
}

function storedQuestions(value: string[] | null): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((item) => typeof item === "string" && item.trim());
}

/**
 * Suggestions for the empty chat.
 * Uses the newest ready document. While a newer upload is still indexing,
 * earlier ready questions stay visible and status is "processing".
 */
export async function getSuggestionsForUser(
  userId: string,
): Promise<UserSuggestions> {
  const db = getDb();
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt));

  const newest = rows[0];
  const indexing = newest ? PROCESSING.includes(newest.status) : false;
  const source =
    newest?.status === "ready"
      ? newest
      : rows.find((row) => row.status === "ready");

  if (!source) {
    return {
      questions: [],
      filename: indexing ? (newest?.filename ?? null) : null,
      status: indexing ? "processing" : "empty",
    };
  }

  let questions = storedQuestions(source.suggestedQuestions);
  if (questions === null) {
    try {
      questions = await generateAndStoreSuggestions(source.id);
    } catch (error) {
      console.warn("[suggestions]", error);
      questions = [];
    }
  }

  return {
    questions: questions.slice(0, MAX_SUGGESTIONS),
    filename: source.filename,
    status: indexing && newest?.id !== source.id ? "processing" : "ready",
  };
}
