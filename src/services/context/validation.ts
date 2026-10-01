import { AppError } from "@/services/ai/errors";
import type { KnowledgeSearchHit } from "@/services/search/postgres";

/** Default token budget for context passed to a future Sonnet call. */
export const DEFAULT_CONTEXT_MAX_TOKENS = 3_000;

/** Hard cap so callers cannot request an unbounded budget. */
export const MAX_CONTEXT_MAX_TOKENS = 8_000;

/** Max Q&A excerpts to consider (after rank ordering). */
export const DEFAULT_CONTEXT_MAX_ITEMS = 5;

export const MAX_CONTEXT_MAX_ITEMS = 10;

/** Drop hits at or below this rank (noise floor). */
export const DEFAULT_MIN_RANK = 0;

/** Approximate tokens from character length (no tokenizer dependency). */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / 4));
}

function isKnowledgeSearchHit(value: unknown): value is KnowledgeSearchHit {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    typeof row.question === "string" &&
    typeof row.answer === "string" &&
    (row.category === null || typeof row.category === "string") &&
    typeof row.sourceDocument === "string" &&
    (row.sourcePage === null || typeof row.sourcePage === "number") &&
    typeof row.rank === "number" &&
    Number.isFinite(row.rank)
  );
}

export type ContextBuilderInput = {
  results: KnowledgeSearchHit[];
  searchQuery?: string;
  intent?: string;
  maxTokens?: number;
  maxItems?: number;
  minRank?: number;
};

export function validateContextBuilderInput(input: {
  results?: unknown;
  searchQuery?: unknown;
  intent?: unknown;
  maxTokens?: unknown;
  maxItems?: unknown;
  minRank?: unknown;
}): ContextBuilderInput {
  if (!Array.isArray(input.results)) {
    throw new AppError(
      "INVALID_INPUT",
      "results must be an array of knowledge search hits.",
      400,
    );
  }

  if (input.results.length > 50) {
    throw new AppError(
      "INVALID_INPUT",
      "results must contain at most 50 items.",
      400,
    );
  }

  const results: KnowledgeSearchHit[] = [];

  for (const [index, item] of input.results.entries()) {
    if (!isKnowledgeSearchHit(item)) {
      throw new AppError(
        "INVALID_INPUT",
        `results[${index}] is not a valid knowledge search hit.`,
        400,
      );
    }
    results.push({
      id: item.id.trim(),
      question: item.question,
      answer: item.answer,
      category: item.category,
      sourceDocument: item.sourceDocument,
      sourcePage: item.sourcePage,
      rank: item.rank,
    });
  }

  let searchQuery: string | undefined;
  if (input.searchQuery !== undefined) {
    if (typeof input.searchQuery !== "string") {
      throw new AppError(
        "INVALID_INPUT",
        "searchQuery must be a string when provided.",
        400,
      );
    }
    searchQuery = input.searchQuery.trim() || undefined;
  }

  let intent: string | undefined;
  if (input.intent !== undefined) {
    if (typeof input.intent !== "string") {
      throw new AppError(
        "INVALID_INPUT",
        "intent must be a string when provided.",
        400,
      );
    }
    intent = input.intent.trim() || undefined;
  }

  let maxTokens = DEFAULT_CONTEXT_MAX_TOKENS;
  if (input.maxTokens !== undefined) {
    if (
      typeof input.maxTokens !== "number" ||
      !Number.isInteger(input.maxTokens) ||
      input.maxTokens < 100
    ) {
      throw new AppError(
        "INVALID_INPUT",
        "maxTokens must be an integer of at least 100.",
        400,
      );
    }
    if (input.maxTokens > MAX_CONTEXT_MAX_TOKENS) {
      throw new AppError(
        "INVALID_INPUT",
        `maxTokens must be at most ${MAX_CONTEXT_MAX_TOKENS}.`,
        400,
      );
    }
    maxTokens = input.maxTokens;
  }

  let maxItems = DEFAULT_CONTEXT_MAX_ITEMS;
  if (input.maxItems !== undefined) {
    if (
      typeof input.maxItems !== "number" ||
      !Number.isInteger(input.maxItems) ||
      input.maxItems < 1
    ) {
      throw new AppError(
        "INVALID_INPUT",
        "maxItems must be a positive integer.",
        400,
      );
    }
    if (input.maxItems > MAX_CONTEXT_MAX_ITEMS) {
      throw new AppError(
        "INVALID_INPUT",
        `maxItems must be at most ${MAX_CONTEXT_MAX_ITEMS}.`,
        400,
      );
    }
    maxItems = input.maxItems;
  }

  let minRank = DEFAULT_MIN_RANK;
  if (input.minRank !== undefined) {
    if (typeof input.minRank !== "number" || !Number.isFinite(input.minRank)) {
      throw new AppError(
        "INVALID_INPUT",
        "minRank must be a finite number when provided.",
        400,
      );
    }
    minRank = input.minRank;
  }

  return {
    results,
    searchQuery,
    intent,
    maxTokens,
    maxItems,
    minRank,
  };
}
