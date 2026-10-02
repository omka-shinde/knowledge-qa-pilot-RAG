import { and, eq, sql } from "drizzle-orm";
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
 * Look up a previously answered question by user + normalized key.
 */
export async function getCachedAsk(
  question: string,
  userId?: string | null,
): Promise<CachedAskPayload | null> {
  const questionNormalized = toCacheKey(question);
  if (!questionNormalized || !userId) {
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
      .where(
        and(
          eq(askCache.userId, userId),
          eq(askCache.questionNormalized, questionNormalized),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      logCacheEvent("miss", { questionNormalized, userId });
      return null;
    }

    await db
      .update(askCache)
      .set({
        hitCount: sql`${askCache.hitCount} + 1`,
        lastHitAt: new Date(),
      })
      .where(
        and(
          eq(askCache.userId, userId),
          eq(askCache.questionNormalized, questionNormalized),
        ),
      );

    logCacheEvent("hit", { questionNormalized, userId });

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
 * Persist a successful ask response for future identical questions (per user).
 */
export async function setCachedAsk(
  question: string,
  result: CachedAskPayload,
  userId?: string | null,
): Promise<void> {
  const questionNormalized = toCacheKey(question);
  if (!questionNormalized || !userId) {
    return;
  }

  try {
    const db = getDb();
    const now = new Date();

    await db
      .insert(askCache)
      .values({
        userId,
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
        target: [askCache.userId, askCache.questionNormalized],
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

    logCacheEvent("store", { questionNormalized, userId });
  } catch (error) {
    logCacheEvent("error", {
      operation: "set",
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Wipe ask_cache for a user after their corpus changes (upload / delete).
 * If userId omitted, clears the entire cache (legacy/admin).
 */
export async function clearAskCache(userId?: string): Promise<void> {
  try {
    const db = getDb();
    if (userId) {
      await db.delete(askCache).where(eq(askCache.userId, userId));
      logCacheEvent("store", { cleared: true, userId });
      return;
    }
    await db.delete(askCache);
    logCacheEvent("store", { cleared: true });
  } catch (error) {
    logCacheEvent("error", {
      operation: "clear",
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
