import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { knowledgeEntries } from "@/lib/db/schema";
import type { ValidatedKnowledgeRecord } from "@/services/ingestion/types";

export type ImportResult = {
  inserted: number;
  skippedExisting: number;
  skippedExistingQuestions: string[];
};

/**
 * Insert validated knowledge records into PostgreSQL.
 * Skips rows whose question_normalized already exists (DB-level duplicates).
 */
export async function importKnowledgeRecords(
  records: ValidatedKnowledgeRecord[],
): Promise<ImportResult> {
  if (records.length === 0) {
    return { inserted: 0, skippedExisting: 0, skippedExistingQuestions: [] };
  }

  const db = getDb();
  const keys = records.map((record) => record.questionNormalized);

  const existing = await db
    .select({
      questionNormalized: knowledgeEntries.questionNormalized,
    })
    .from(knowledgeEntries)
    .where(inArray(knowledgeEntries.questionNormalized, keys));

  const existingKeys = new Set(
    existing.map((row) => row.questionNormalized),
  );

  const toInsert = records.filter(
    (record) => !existingKeys.has(record.questionNormalized),
  );
  const skipped = records.filter((record) =>
    existingKeys.has(record.questionNormalized),
  );

  if (toInsert.length > 0) {
    await db.insert(knowledgeEntries).values(
      toInsert.map((record) => ({
        question: record.question,
        answer: record.answer,
        category: record.category,
        sourceDocument: record.sourceDocument,
        sourcePage: record.sourcePage,
        searchableContent: record.searchableContent,
        questionNormalized: record.questionNormalized,
      })),
    );
  }

  return {
    inserted: toInsert.length,
    skippedExisting: skipped.length,
    skippedExistingQuestions: skipped.map((record) => record.question),
  };
}

/** Optional helper for tests / ops — count rows for a source document. */
export async function countEntriesForDocument(
  sourceDocument: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: knowledgeEntries.id })
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.sourceDocument, sourceDocument));
  return rows.length;
}
