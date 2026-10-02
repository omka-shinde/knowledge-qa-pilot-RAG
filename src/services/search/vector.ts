/**
 * Vector similarity search over uploaded document chunks (pgvector).
 */

import { sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import { AppError } from "@/services/ai/errors";
import { embedText } from "@/services/documents/embeddings";
import type { KnowledgeSearchHit, KnowledgeSearchResult } from "@/services/search/postgres";
import {
  DEFAULT_SEARCH_LIMIT,
  validateSearchInput,
} from "@/services/search/validation";

export type SearchChunksOptions = {
  limit?: unknown;
  db?: Db;
  /** Precomputed query embedding (skips embedText). */
  queryEmbedding?: number[];
  /** Restrict results to this user's documents. */
  userId?: string;
};

type ChunkRow = {
  id: string;
  content: string;
  filename: string;
  chunkIndex: number;
  distance: number | string;
};

function toDistance(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 1;
}

/**
 * Cosine-distance search against ready document chunks.
 * Returns KnowledgeSearchHit-compatible rows for the existing context builder.
 */
export async function searchDocumentChunks(
  searchQuery: unknown,
  options: SearchChunksOptions = {},
): Promise<KnowledgeSearchResult> {
  const { searchQuery: query, limit } = validateSearchInput({
    searchQuery,
    limit: options.limit ?? DEFAULT_SEARCH_LIMIT,
  });

  try {
    const embedding =
      options.queryEmbedding ?? (await embedText(query));
    const vectorSql = sql.raw(
      `'[${embedding.map((n) => Number(n)).join(",")}]'::vector`,
    );
    const db = options.db ?? getDb();

    const executed = await db.execute(sql`
      SELECT
        c.id,
        c.content,
        c.chunk_index AS "chunkIndex",
        d.filename,
        (c.embedding <=> ${vectorSql}) AS distance
      FROM document_chunks c
      INNER JOIN documents d ON d.id = c.document_id
      WHERE d.status = 'ready'
        AND c.embedding IS NOT NULL
        ${
          options.userId
            ? sql`AND d.user_id = ${options.userId}`
            : sql``
        }
      ORDER BY c.embedding <=> ${vectorSql}
      LIMIT ${limit}
    `);

    const rows = (
      Array.isArray(executed)
        ? executed
        : ((executed as { rows?: ChunkRow[] }).rows ?? [])
    ) as ChunkRow[];

    const results: KnowledgeSearchHit[] = rows.map((row) => {
      const distance = toDistance(row.distance);
      // Convert distance (0 = identical) to a rank-like score (higher = better).
      const rank = Math.max(0, 1 - distance);

      return {
        id: row.id,
        question: `Excerpt from ${row.filename} (chunk ${row.chunkIndex + 1})`,
        answer: row.content,
        category: null,
        sourceDocument: row.filename,
        sourcePage: row.chunkIndex + 1,
        rank,
      };
    });

    return {
      searchQuery: query,
      count: results.length,
      results,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Vector search failed.";
    throw new AppError("DATABASE_ERROR", message, 503);
  }
}

/**
 * Hybrid retrieval: vector chunks first, then FAQ FTS hits (deduped by id).
 */
export async function searchHybrid(
  searchQuery: unknown,
  options: SearchChunksOptions & {
    searchKnowledge?: (
      q: unknown,
      opts?: { limit?: unknown; db?: Db },
    ) => Promise<KnowledgeSearchResult>;
  } = {},
): Promise<KnowledgeSearchResult> {
  const { searchQuery: query, limit } = validateSearchInput({
    searchQuery,
    limit: options.limit ?? DEFAULT_SEARCH_LIMIT,
  });
  const resultLimit = limit ?? DEFAULT_SEARCH_LIMIT;

  const vectorPromise = searchDocumentChunks(query, {
    limit: resultLimit,
    db: options.db,
    queryEmbedding: options.queryEmbedding,
    userId: options.userId,
  }).catch((error) => {
    // If no OPENAI key / no chunks yet, fall back to empty vector results.
    console.warn("[search-hybrid] vector search skipped:", error);
    return {
      searchQuery: query,
      count: 0,
      results: [] as KnowledgeSearchHit[],
    };
  });

  // When scoped to a user, only search their uploaded docs (skip shared FAQ FTS).
  if (options.userId) {
    const vector = await vectorPromise;
    return {
      searchQuery: query,
      count: vector.results.length,
      results: vector.results.slice(0, resultLimit),
    };
  }

  const { searchKnowledge } = await import("@/services/search/postgres");
  const runFts = options.searchKnowledge ?? searchKnowledge;

  const ftsPromise = runFts(query, { limit: resultLimit, db: options.db }).catch(
    (error) => {
      console.warn("[search-hybrid] FTS skipped:", error);
      return {
        searchQuery: query,
        count: 0,
        results: [] as KnowledgeSearchHit[],
      };
    },
  );

  const [vector, fts] = await Promise.all([vectorPromise, ftsPromise]);

  const seen = new Set<string>();
  const merged: KnowledgeSearchHit[] = [];

  for (const hit of [...vector.results, ...fts.results]) {
    if (seen.has(hit.id)) {
      continue;
    }
    seen.add(hit.id);
    merged.push(hit);
    if (merged.length >= resultLimit) {
      break;
    }
  }

  // Prefer higher rank after merge.
  merged.sort((a, b) => b.rank - a.rank);

  return {
    searchQuery: query,
    count: merged.length,
    results: merged,
  };
}
