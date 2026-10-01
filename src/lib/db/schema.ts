import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Knowledge-base entries extracted from FAQ PDFs.
 *
 * Field rationale:
 * - question / answer: core searchable Q&A content from the PDF
 * - category: PDF section headings (e.g. "IV. SOIL AND NUTRITION") when present
 * - sourceDocument / sourcePage: traceability back to the PDF for debugging search
 * - searchableContent: denormalized question+answer for Phase 4 Postgres text search
 * - questionNormalized: stable key for duplicate detection (not for display)
 * - createdAt / updatedAt: audit timestamps
 */
export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    category: text("category"),
    sourceDocument: text("source_document").notNull(),
    sourcePage: integer("source_page"),
    searchableContent: text("searchable_content").notNull(),
    questionNormalized: text("question_normalized").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("knowledge_entries_question_normalized_uidx").on(
      table.questionNormalized,
    ),
    index("knowledge_entries_source_document_idx").on(table.sourceDocument),
    // Expression GIN index prepares Phase 4 full-text search (not used yet).
    index("knowledge_entries_searchable_content_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.searchableContent})`,
    ),
  ],
);

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert;

/**
 * Cached end-to-end ask responses.
 * Keyed by normalized question so repeated asks skip Haiku + search + Sonnet.
 */
export type AskCacheSource = {
  id: string;
  question: string;
  sourceDocument: string;
  sourcePage: number | null;
};

export const askCache = pgTable(
  "ask_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionNormalized: text("question_normalized").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    intent: text("intent").notNull(),
    searchQuery: text("search_query").notNull(),
    resultCount: integer("result_count").notNull(),
    includedCount: integer("included_count").notNull(),
    sources: jsonb("sources").$type<AskCacheSource[]>().notNull(),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastHitAt: timestamp("last_hit_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("ask_cache_question_normalized_uidx").on(
      table.questionNormalized,
    ),
  ],
);

export type AskCacheEntry = typeof askCache.$inferSelect;
export type NewAskCacheEntry = typeof askCache.$inferInsert;
