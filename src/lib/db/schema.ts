import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * pgvector column stored as `vector(N)`.
 * Driver round-trips as the Postgres vector literal string.
 */
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.map(Number);
    }
    const raw = String(value);
    const trimmed = raw.startsWith("[") ? raw.slice(1, -1) : raw;
    if (!trimmed) {
      return [];
    }
    return trimmed.split(",").map((part) => Number(part.trim()));
  },
});

/** OpenAI text-embedding-3-small output size. */
export const EMBEDDING_DIMENSIONS = 1536;

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
 * Application users (email/password auth).
 * Passwords are stored as bcrypt hashes — never plaintext.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("users_email_uidx").on(table.email)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Cached end-to-end ask responses.
 * Keyed by user + normalized question so repeated asks skip Haiku + search + Sonnet.
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
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
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
    uniqueIndex("ask_cache_user_question_normalized_uidx").on(
      table.userId,
      table.questionNormalized,
    ),
  ],
);

export type AskCacheEntry = typeof askCache.$inferSelect;
export type NewAskCacheEntry = typeof askCache.$inferInsert;

/** Upload / processing lifecycle for user-uploaded documents. */
export type DocumentStatus =
  | "uploaded"
  | "extracting"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    storagePath: text("storage_path").notNull(),
    status: text("status").$type<DocumentStatus>().notNull().default("uploaded"),
    statusMessage: text("status_message"),
    error: text("error"),
    chunkCount: integer("chunk_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("documents_status_idx").on(table.status),
    index("documents_created_at_idx").on(table.createdAt),
    index("documents_user_id_idx").on(table.userId),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

/**
 * Text chunks + embeddings for uploaded documents.
 * Embedding is OpenAI text-embedding-3-small (1536 dims).
 */
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("document_chunks_document_id_idx").on(table.documentId),
    uniqueIndex("document_chunks_document_id_chunk_index_uidx").on(
      table.documentId,
      table.chunkIndex,
    ),
  ],
);

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;

/**
 * Chat threads (ChatGPT-style) — one conversation per user thread.
 */
export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chat_threads_user_id_idx").on(table.userId),
    index("chat_threads_updated_at_idx").on(table.updatedAt),
  ],
);

export type ChatThread = typeof chatThreads.$inferSelect;
export type NewChatThread = typeof chatThreads.$inferInsert;

export type ChatMessageRole = "user" | "assistant";

export type ChatMessageSource = {
  id: string;
  question: string;
  sourceDocument: string;
  sourcePage: number | null;
};

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").$type<ChatMessageRole>().notNull(),
    content: text("content").notNull(),
    sources: jsonb("sources").$type<ChatMessageSource[] | null>(),
    cached: integer("cached").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chat_messages_thread_id_idx").on(table.threadId),
    index("chat_messages_created_at_idx").on(table.createdAt),
  ],
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type NewChatMessageRow = typeof chatMessages.$inferInsert;
