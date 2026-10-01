import type Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import {
  getAnthropicApiKeyOptional,
  getHaikuModel,
} from "@/lib/env";
import {
  createAnthropicClient,
  mapAnthropicError,
  shouldSkipAiLogs,
} from "@/services/ai/anthropic";
import { AppError } from "@/services/ai/errors";
import {
  validateQuestionInput,
  validateQueryUnderstandingOutput,
  type QueryUnderstandingResult,
} from "@/services/ai/validation";

export type { QueryUnderstandingResult };

const HAIKU_SYSTEM_PROMPT = `You are a query-understanding component for a knowledge-base search system.

Your job:
1. Understand the user's question.
2. Identify the likely intent as a short descriptive snake_case or lowercase phrase (not a fixed taxonomy).
3. Create a concise search query suitable for PostgreSQL text search.
4. Preserve important entities, terminology, names, numbers, dates, and concepts.
5. Remove unnecessary conversational wording.

Hard rules:
- Do NOT answer the user's question.
- Do NOT invent facts about the knowledge base.
- Do NOT include explanations, markdown, or extra fields.
- Return only the structured object with intent and searchQuery.`;

const queryUnderstandingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      description:
        "Short descriptive intent label derived from the question (not a fixed enum).",
    },
    searchQuery: {
      type: "string",
      description:
        "Concise search string for PostgreSQL text search, preserving key terms.",
    },
  },
  required: ["intent", "searchQuery"],
} as const;

export type ProcessQuestionOptions = {
  /** Injected Anthropic client for tests. */
  client?: Anthropic;
  /** Override model ID (defaults to ANTHROPIC_HAIKU_MODEL / documented default). */
  model?: string;
  /** Override API key (defaults to ANTHROPIC_API_KEY). */
  apiKey?: string;
};

function logHaikuEvent(
  event: "success" | "failure",
  meta: {
    model: string;
    latencyMs: number;
    category?: string;
  },
): void {
  if (shouldSkipAiLogs()) {
    return;
  }

  if (event === "success") {
    console.info("[haiku]", {
      event,
      model: meta.model,
      latencyMs: meta.latencyMs,
    });
    return;
  }

  console.warn("[haiku]", {
    event,
    model: meta.model,
    latencyMs: meta.latencyMs,
    category: meta.category,
  });
}

/**
 * Claude Haiku query-understanding layer.
 * Returns structured search information only — never a final user answer.
 */
export async function processQuestion(
  question: unknown,
  options: ProcessQuestionOptions = {},
): Promise<QueryUnderstandingResult> {
  const validatedQuestion = validateQuestionInput(question);
  const model = options.model ?? getHaikuModel();

  if (!model.trim()) {
    throw new AppError(
      "INVALID_MODEL_CONFIG",
      "Haiku model is not configured.",
      500,
    );
  }

  const apiKey = options.apiKey ?? getAnthropicApiKeyOptional();
  if (!options.client && !apiKey) {
    throw new AppError(
      "MISSING_API_KEY",
      "AI service is not configured.",
      503,
    );
  }

  const client = options.client ?? createAnthropicClient(apiKey as string);
  const startedAt = Date.now();

  try {
    const message = await client.messages.parse({
      model,
      max_tokens: 256,
      system: HAIKU_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: validatedQuestion,
        },
      ],
      output_config: {
        format: jsonSchemaOutputFormat(queryUnderstandingSchema),
      },
    });

    if (message.parsed_output == null) {
      throw new AppError(
        "EMPTY_MODEL_OUTPUT",
        "The query-understanding service returned an empty response.",
        502,
      );
    }

    const result = validateQueryUnderstandingOutput(message.parsed_output);

    logHaikuEvent("success", {
      model,
      latencyMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    const mapped = mapAnthropicError(
      error,
      "Something went wrong while understanding the question.",
    );
    logHaikuEvent("failure", {
      model,
      latencyMs: Date.now() - startedAt,
      category: mapped.code,
    });
    throw mapped;
  }
}
