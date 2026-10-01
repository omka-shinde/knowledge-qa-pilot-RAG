import { sql, type SQL } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import { knowledgeEntries } from "@/lib/db/schema";
import { AppError } from "@/services/ai/errors";
import {
  DEFAULT_SEARCH_LIMIT,
  validateSearchInput,
} from "@/services/search/validation";

export type KnowledgeSearchHit = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sourceDocument: string;
  sourcePage: number | null;
  /** PostgreSQL ts_rank score (higher is better). */
  rank: number;
};

export type KnowledgeSearchResult = {
  searchQuery: string;
  count: number;
  results: KnowledgeSearchHit[];
};

export type SearchKnowledgeOptions = {
  /** Override default limit (still validated). */
  limit?: unknown;
  /** Injected Drizzle client for tests. */
  db?: Db;
};

type RankedRow = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sourceDocument: string;
  sourcePage: number | null;
  rank: number | string;
};

function toRank(value: number | string): number {
  const rank = typeof value === "number" ? value : Number(value);
  return Number.isFinite(rank) ? rank : 0;
}

/**
 * Builds an OR-of-terms tsquery instead of `plainto_tsquery`'s implicit AND.
 *
 * Haiku-generated search queries often include a word (e.g. a synonym or
 * qualifier) that isn't present in the stored FAQ text. `plainto_tsquery`
 * ANDs every word together, so one non-matching word zeroes out an
 * otherwise-strong match. ORing each word's tsquery keeps partial-term
 * matches (ranked by `ts_rank`, which rewards matching more terms) instead
 * of losing them entirely.
 */
function buildTsQuery(searchQuery: string): SQL {
  const words = searchQuery.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return sql`(plainto_tsquery('english', ${searchQuery}))`;
  }

  const combined = words
    .slice(1)
    .reduce<SQL>(
      (acc, word) => sql`${acc} || plainto_tsquery('english', ${word})`,
      sql`plainto_tsquery('english', ${words[0]})`,
    );

  // Always return a parenthesized expression: callers embed this next to
  // operators like `@@` whose precedence would otherwise split an
  // unparenthesized `... || lastWord` off the end, applying it to the
  // boolean result of `@@` instead of staying inside the tsquery OR-chain.
  return sql`(${combined})`;
}

function logSearchEvent(
  event: "success" | "failure",
  meta: {
    latencyMs: number;
    count?: number;
    category?: string;
    detail?: string;
  },
): void {
  if (
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test"
  ) {
    return;
  }

  if (event === "success") {
    console.info("[search]", {
      event,
      latencyMs: meta.latencyMs,
      count: meta.count,
    });
    return;
  }

  console.warn("[search]", {
    event,
    latencyMs: meta.latencyMs,
    category: meta.category,
    detail: meta.detail,
  });
}

/**
 * Search the knowledge base with PostgreSQL full-text search.
 *
 * Uses the Phase 2 GIN expression index on:
 *   to_tsvector('english', searchable_content)
 *
 * Accepts Haiku's `searchQuery` (or any concise query string).
 * Does not call Haiku, Context Builder, or Sonnet.
 */
export async function searchKnowledge(
  searchQueryInput: unknown,
  options: SearchKnowledgeOptions = {},
): Promise<KnowledgeSearchResult> {
  const { searchQuery, limit = DEFAULT_SEARCH_LIMIT } = validateSearchInput({
    searchQuery: searchQueryInput,
    limit: options.limit,
  });

  const db = options.db ?? getDb();
  const startedAt = Date.now();

  try {
    const vector = sql`to_tsvector('english', ${knowledgeEntries.searchableContent})`;
    const query = buildTsQuery(searchQuery);

    const rows = (await db
      .select({
        id: knowledgeEntries.id,
        question: knowledgeEntries.question,
        answer: knowledgeEntries.answer,
        category: knowledgeEntries.category,
        sourceDocument: knowledgeEntries.sourceDocument,
        sourcePage: knowledgeEntries.sourcePage,
        rank: sql<number>`ts_rank(${vector}, ${query})`.as("rank"),
      })
      .from(knowledgeEntries)
      .where(sql`${vector} @@ ${query}`)
      .orderBy(sql`rank DESC`)
      .limit(limit)) as RankedRow[];

    const results: KnowledgeSearchHit[] = rows.map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      category: row.category,
      sourceDocument: row.sourceDocument,
      sourcePage: row.sourcePage,
      rank: toRank(row.rank),
    }));

    logSearchEvent("success", {
      latencyMs: Date.now() - startedAt,
      count: results.length,
    });

    return {
      searchQuery,
      count: results.length,
      results,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const detail = error instanceof Error ? error.message : String(error);
    logSearchEvent("failure", {
      latencyMs: Date.now() - startedAt,
      category: "DATABASE_ERROR",
      detail,
    });

    throw new AppError(
      "DATABASE_ERROR",
      "Knowledge search is temporarily unavailable.",
      503,
    );
  }
}
