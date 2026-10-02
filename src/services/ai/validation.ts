import { AppError } from "@/services/ai/errors";

/** Reasonable upper bound for a single user question (characters). */
export const MAX_QUESTION_LENGTH = 2_000;

export function validateQuestionInput(question: unknown): string {
  if (typeof question !== "string") {
    throw new AppError(
      "INVALID_INPUT",
      "Question must be a string.",
      400,
    );
  }

  const trimmed = question.trim();

  if (!trimmed) {
    throw new AppError(
      "INVALID_INPUT",
      "Question is required.",
      400,
    );
  }

  if (trimmed.length > MAX_QUESTION_LENGTH) {
    throw new AppError(
      "INVALID_INPUT",
      `Question must be at most ${MAX_QUESTION_LENGTH} characters.`,
      400,
    );
  }

  return trimmed;
}

export type QueryUnderstandingResult = {
  intent: string;
  searchQuery: string;
};

export type AnswerGenerationResult = {
  answer: string;
};

/** Reasonable upper bound for context text passed to Sonnet. */
export const MAX_CONTEXT_TEXT_LENGTH = 24_000;

export function validateAnswerGenerationInput(input: {
  question?: unknown;
  contextText?: unknown;
  intent?: unknown;
  searchQuery?: unknown;
  conversationHistory?: unknown;
}): {
  question: string;
  contextText: string;
  intent: string | null;
  searchQuery: string | null;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const question = validateQuestionInput(input.question);

  if (typeof input.contextText !== "string") {
    throw new AppError(
      "INVALID_INPUT",
      "contextText must be a string.",
      400,
    );
  }

  const contextText = input.contextText.trim();
  if (!contextText) {
    throw new AppError(
      "INVALID_INPUT",
      "contextText is required.",
      400,
    );
  }

  if (contextText.length > MAX_CONTEXT_TEXT_LENGTH) {
    throw new AppError(
      "INVALID_INPUT",
      `contextText must be at most ${MAX_CONTEXT_TEXT_LENGTH} characters.`,
      400,
    );
  }

  let intent: string | null = null;
  if (input.intent !== undefined && input.intent !== null) {
    if (typeof input.intent !== "string") {
      throw new AppError(
        "INVALID_INPUT",
        "intent must be a string when provided.",
        400,
      );
    }
    intent = input.intent.trim() || null;
  }

  let searchQuery: string | null = null;
  if (input.searchQuery !== undefined && input.searchQuery !== null) {
    if (typeof input.searchQuery !== "string") {
      throw new AppError(
        "INVALID_INPUT",
        "searchQuery must be a string when provided.",
        400,
      );
    }
    searchQuery = input.searchQuery.trim() || null;
  }

  const conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];
  if (input.conversationHistory !== undefined && input.conversationHistory !== null) {
    if (!Array.isArray(input.conversationHistory)) {
      throw new AppError(
        "INVALID_INPUT",
        "conversationHistory must be an array when provided.",
        400,
      );
    }
    for (const item of input.conversationHistory) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const role = (item as { role?: unknown }).role;
      const rawContent = (item as { content?: unknown }).content;
      if (
        (role !== "user" && role !== "assistant") ||
        typeof rawContent !== "string"
      ) {
        continue;
      }
      const content = rawContent.trim();
      if (!content) {
        continue;
      }
      conversationHistory.push({ role, content });
    }
  }

  return { question, contextText, intent, searchQuery, conversationHistory };
}

/**
 * Strict validation of Sonnet structured output.
 */
export function validateAnswerGenerationOutput(
  value: unknown,
): AnswerGenerationResult {
  if (value === null || value === undefined) {
    throw new AppError(
      "EMPTY_MODEL_OUTPUT",
      "The answer service returned an empty response.",
      502,
    );
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(
      "MALFORMED_MODEL_OUTPUT",
      "The answer service returned an unexpected response.",
      502,
    );
  }

  const record = value as Record<string, unknown>;

  if (!("answer" in record) || typeof record.answer !== "string") {
    throw new AppError(
      "MALFORMED_MODEL_OUTPUT",
      "The answer service returned an unexpected response.",
      502,
    );
  }

  const answer = record.answer.trim();
  if (!answer) {
    throw new AppError(
      "MALFORMED_MODEL_OUTPUT",
      "The answer service returned an empty answer.",
      502,
    );
  }

  return { answer };
}

/**
 * Strict validation of Haiku structured output.
 * Accepts only non-empty trimmed intent and searchQuery strings.
 */
export function validateQueryUnderstandingOutput(
  value: unknown,
): QueryUnderstandingResult {
  if (value === null || value === undefined) {
    throw new AppError(
      "EMPTY_MODEL_OUTPUT",
      "The query-understanding service returned an empty response.",
      502,
    );
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(
      "MALFORMED_MODEL_OUTPUT",
      "The query-understanding service returned an unexpected response.",
      502,
    );
  }

  const record = value as Record<string, unknown>;

  if (!("intent" in record) || !("searchQuery" in record)) {
    throw new AppError(
      "MALFORMED_MODEL_OUTPUT",
      "The query-understanding service returned an unexpected response.",
      502,
    );
  }

  if (typeof record.intent !== "string" || typeof record.searchQuery !== "string") {
    throw new AppError(
      "MALFORMED_MODEL_OUTPUT",
      "The query-understanding service returned an unexpected response.",
      502,
    );
  }

  const intent = record.intent.trim();
  const searchQuery = record.searchQuery.trim();

  if (!intent || !searchQuery) {
    throw new AppError(
      "MALFORMED_MODEL_OUTPUT",
      "The query-understanding service returned incomplete fields.",
      502,
    );
  }

  return { intent, searchQuery };
}
