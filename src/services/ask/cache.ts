import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { askCache, type AskCacheSource } from "@/lib/db/schema";
import { normalizeQuestionKey } from "@/services/ingestion/normalizer";

export type CachedAskPayload = {
  answer: string;
  intent: string;
  searchQuery: string;
  resultCount: number;
  includedCount: number;
  sources: AskCacheSource[];
};

function shouldSkipLogs(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test"
  );
}

function logCacheEvent(
  event: "hit" | "miss" | "store" | "error",
  meta: Record<string, unknown>,
): void {
  if (shouldSkipLogs()) {
    return;
  }
  console.info("[ask-cache]", { event, ...meta });
}

export function toCacheKey(question: string): string {
  return normalizeQuestionKey(question);
}

/**
 * Look up a previously answered question by normalized key.
 * Returns null on miss or if the cache is unavailable.
 */
export async function getCachedAsk(
  question: string,
): Promise<CachedAskPayload | null> {
  const questionNormalized = toCacheKey(question);
  if (!questionNormalized) {
    return null;
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        answer: askCache.answer,
        intent: askCache.intent,
        searchQuery: askCache.searchQuery,
        resultCount: askCache.resultCount,
        includedCount: askCache.includedCount,
        sources: askCache.sources,
      })
      .from(askCache)
      .where(eq(askCache.questionNormalized, questionNormalized))
      .limit(1);

    const row = rows[0];
    if (!row) {
      logCacheEvent("miss", { questionNormalized });
      return null;
    }

    await db
      .update(askCache)
      .set({
        hitCount: sql`${askCache.hitCount} + 1`,
        lastHitAt: new Date(),
      })
      .where(eq(askCache.questionNormalized, questionNormalized));

    logCacheEvent("hit", { questionNormalized });

    return {
      answer: row.answer,
      intent: row.intent,
      searchQuery: row.searchQuery,
      resultCount: row.resultCount,
      includedCount: row.includedCount,
      sources: row.sources as AskCacheSource[],
    };
  } catch (error) {
    logCacheEvent("error", {
      operation: "get",
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/**
 * Persist a successful ask response for future identical questions.
 * Best-effort: failures are logged and swallowed.
 */
export async function setCachedAsk(
  question: string,
  result: CachedAskPayload,
): Promise<void> {
  const questionNormalized = toCacheKey(question);
  if (!questionNormalized) {
    return;
  }

  try {
    const db = getDb();
    const now = new Date();

    await db
      .insert(askCache)
      .values({
        questionNormalized,
        question,
        answer: result.answer,
        intent: result.intent,
        searchQuery: result.searchQuery,
        resultCount: result.resultCount,
        includedCount: result.includedCount,
        sources: result.sources,
        hitCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: askCache.questionNormalized,
        set: {
          question,
          answer: result.answer,
          intent: result.intent,
          searchQuery: result.searchQuery,
          resultCount: result.resultCount,
          includedCount: result.includedCount,
          sources: result.sources,
          updatedAt: now,
        },
      });

    logCacheEvent("store", { questionNormalized });
  } catch (error) {
    logCacheEvent("error", {
      operation: "set",
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Wipe ask_cache after the knowledge corpus changes (upload / delete).
 */
export async function clearAskCache(): Promise<void> {
  try {
    const db = getDb();
    await db.delete(askCache);
    logCacheEvent("store", { cleared: true });
  } catch (error) {
    logCacheEvent("error", {
      operation: "clear",
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
