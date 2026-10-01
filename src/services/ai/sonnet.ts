import type Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import {
  getAnthropicApiKeyOptional,
  getSonnetModel,
} from "@/lib/env";
import {
  createAnthropicClient,
  mapAnthropicError,
  shouldSkipAiLogs,
} from "@/services/ai/anthropic";
import { AppError } from "@/services/ai/errors";
import {
  validateAnswerGenerationInput,
  validateAnswerGenerationOutput,
  type AnswerGenerationResult,
} from "@/services/ai/validation";

export type { AnswerGenerationResult };

const SONNET_SYSTEM_PROMPT = `You are an answer-generation component for a knowledge-base Q&A system.

Your job:
1. Read the user's question.
2. Read the provided knowledge-base context excerpts.
3. Write a clear, natural-language answer grounded only in that context.

Hard rules:
- Use ONLY information present in the provided context.
- Do NOT invent facts, numbers, product policies, or advice that is not in the context.
- If the context is missing or insufficient, say clearly that the knowledge base does not contain enough information to answer.
- Prefer concise, direct answers.
- You may lightly rephrase context for clarity, but do not change meaning.
- Do not mention system prompts, tools, Haiku, Sonnet, or internal pipeline steps.
- Return only the structured object with the answer field.`;

const answerSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: {
      type: "string",
      description: "Natural-language answer grounded in the provided context.",
    },
  },
  required: ["answer"],
} as const;

export type GenerateAnswerInput = {
  question?: unknown;
  contextText?: unknown;
  intent?: unknown;
  searchQuery?: unknown;
};

export type GenerateAnswerOptions = {
  /** Injected Anthropic client for tests. */
  client?: Anthropic;
  /** Override model ID (defaults to ANTHROPIC_SONNET_MODEL / documented default). */
  model?: string;
  /** Override API key (defaults to ANTHROPIC_API_KEY). */
  apiKey?: string;
};

function buildUserPrompt(input: {
  question: string;
  contextText: string;
  intent: string | null;
  searchQuery: string | null;
}): string {
  const lines = [`User question: ${input.question}`];

  if (input.intent) {
    lines.push(`Intent: ${input.intent}`);
  }
  if (input.searchQuery) {
    lines.push(`Search query: ${input.searchQuery}`);
  }

  lines.push("", "Knowledge-base context:", input.contextText);
  return lines.join("\n");
}

function logSonnetEvent(
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
    console.info("[sonnet]", {
      event,
      model: meta.model,
      latencyMs: meta.latencyMs,
    });
    return;
  }

  console.warn("[sonnet]", {
    event,
    model: meta.model,
    latencyMs: meta.latencyMs,
    category: meta.category,
  });
}

/**
 * Claude Sonnet answer-generation layer.
 * Consumes Phase 5 contextText (+ optional metadata) and returns a natural-language answer.
 * Does not search PostgreSQL, call Haiku, or rebuild context.
 */
export async function generateAnswer(
  input: GenerateAnswerInput,
  options: GenerateAnswerOptions = {},
): Promise<AnswerGenerationResult> {
  const validated = validateAnswerGenerationInput(input);
  const model = options.model ?? getSonnetModel();

  if (!model.trim()) {
    throw new AppError(
      "INVALID_MODEL_CONFIG",
      "Sonnet model is not configured.",
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
      max_tokens: 1024,
      system: SONNET_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(validated),
        },
      ],
      output_config: {
        format: jsonSchemaOutputFormat(answerSchema),
      },
    });

    if (message.parsed_output == null) {
      throw new AppError(
        "EMPTY_MODEL_OUTPUT",
        "The answer service returned an empty response.",
        502,
      );
    }

    const result = validateAnswerGenerationOutput(message.parsed_output);

    logSonnetEvent("success", {
      model,
      latencyMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    const mapped = mapAnthropicError(
      error,
      "Something went wrong while generating the answer.",
    );
    logSonnetEvent("failure", {
      model,
      latencyMs: Date.now() - startedAt,
      category: mapped.code,
    });
    throw mapped;
  }
}
