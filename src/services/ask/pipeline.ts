import type Anthropic from "@anthropic-ai/sdk";
import { generateAnswer, processQuestion } from "@/services/ai";
import { AppError } from "@/services/ai/errors";
import { buildContext, type BuiltContext } from "@/services/context";
import {
  searchHybrid,
  type KnowledgeSearchResult,
  type SearchKnowledgeOptions,
} from "@/services/search";
import type { QueryUnderstandingResult } from "@/services/ai/haiku";
import type { AnswerGenerationResult } from "@/services/ai/sonnet";
import { validateQuestionInput } from "@/services/ai/validation";
import {
  getCachedAsk,
  setCachedAsk,
  type CachedAskPayload,
} from "@/services/ask/cache";

export type AskPipelineResult = {
  answer: string;
  intent: string;
  searchQuery: string;
  resultCount: number;
  includedCount: number;
  sources: Array<{
    id: string;
    question: string;
    sourceDocument: string;
    sourcePage: number | null;
  }>;
  /** True when the response was served from ask_cache (no AI / search calls). */
  cached: boolean;
};

export type AskPipelineDeps = {
  processQuestion?: (
    question: unknown,
    options?: { client?: Anthropic; model?: string; apiKey?: string },
  ) => Promise<QueryUnderstandingResult>;
  searchKnowledge?: (
    searchQuery: unknown,
    options?: SearchKnowledgeOptions & { userId?: string },
  ) => Promise<KnowledgeSearchResult>;
  buildContext?: (input: {
    results?: unknown;
    searchQuery?: unknown;
    intent?: unknown;
  }) => BuiltContext;
  generateAnswer?: (
    input: {
      question?: unknown;
      contextText?: unknown;
      intent?: unknown;
      searchQuery?: unknown;
      conversationHistory?: unknown;
    },
    options?: { client?: Anthropic; model?: string; apiKey?: string },
  ) => Promise<AnswerGenerationResult>;
  getCachedAsk?: (
    question: string,
    userId?: string | null,
  ) => Promise<CachedAskPayload | null>;
  setCachedAsk?: (
    question: string,
    result: CachedAskPayload,
    userId?: string | null,
  ) => Promise<void>;
  /** Scope retrieval + cache to this user. */
  userId?: string;
  /** Prior turns in the current thread (memory layer). */
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
};

function shouldSkipLogs(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test"
  );
}

function logAskEvent(
  event: "success" | "failure",
  meta: {
    latencyMs: number;
    stage?: string;
    category?: string;
    resultCount?: number;
    cached?: boolean;
  },
): void {
  if (shouldSkipLogs()) {
    return;
  }

  if (event === "success") {
    console.info("[ask]", {
      event,
      latencyMs: meta.latencyMs,
      resultCount: meta.resultCount,
      cached: meta.cached ?? false,
    });
    return;
  }

  console.warn("[ask]", {
    event,
    latencyMs: meta.latencyMs,
    stage: meta.stage,
    category: meta.category,
  });
}

/**
 * End-to-end Q&A pipeline:
 * Cache → (miss) Haiku → PostgreSQL search → Context Builder → Sonnet → store
 *
 * Calls services directly (no internal HTTP).
 */
export async function askQuestion(
  questionInput: unknown,
  deps: AskPipelineDeps = {},
): Promise<AskPipelineResult> {
  const question = validateQuestionInput(questionInput);
  const startedAt = Date.now();
  let stage = "cache";

  const runGetCachedAsk = deps.getCachedAsk ?? getCachedAsk;
  const runSetCachedAsk = deps.setCachedAsk ?? setCachedAsk;
  const runProcessQuestion = deps.processQuestion ?? processQuestion;
  const runSearchKnowledge = deps.searchKnowledge ?? searchHybrid;
  const runBuildContext = deps.buildContext ?? buildContext;
  const runGenerateAnswer = deps.generateAnswer ?? generateAnswer;
  const userId = deps.userId;
  const conversationHistory = deps.conversationHistory ?? [];
  const hasMemory = conversationHistory.length > 0;

  try {
    // Skip single-turn cache when this is a multi-turn thread follow-up.
    if (!hasMemory) {
      const cached = await runGetCachedAsk(question, userId);
      if (cached) {
        const result: AskPipelineResult = { ...cached, cached: true };
        logAskEvent("success", {
          latencyMs: Date.now() - startedAt,
          resultCount: cached.resultCount,
          cached: true,
        });
        return result;
      }
    }

    stage = "haiku";
    const { intent, searchQuery } = await runProcessQuestion(question);

    stage = "search";
    const search = await runSearchKnowledge(searchQuery, { userId });

    stage = "context";
    const context = runBuildContext({
      results: search.results,
      intent,
      searchQuery,
    });

    stage = "sonnet";
    const { answer } = await runGenerateAnswer({
      question,
      contextText: context.contextText,
      intent,
      searchQuery,
      conversationHistory,
    });

    const payload: CachedAskPayload = {
      answer,
      intent,
      searchQuery,
      resultCount: search.count,
      includedCount: context.includedCount,
      sources: context.excerpts.map((excerpt) => ({
        id: excerpt.id,
        question: excerpt.question,
        sourceDocument: excerpt.sourceDocument,
        sourcePage: excerpt.sourcePage,
      })),
    };

    stage = "cache-store";
    if (!hasMemory) {
      await runSetCachedAsk(question, payload, userId);
    }

    const result: AskPipelineResult = { ...payload, cached: false };

    logAskEvent("success", {
      latencyMs: Date.now() - startedAt,
      resultCount: search.count,
      cached: false,
    });

    return result;
  } catch (error) {
    const category = error instanceof AppError ? error.code : "UNKNOWN";
    logAskEvent("failure", {
      latencyMs: Date.now() - startedAt,
      stage,
      category,
    });
    throw error;
  }
}
