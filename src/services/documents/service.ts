/**
 * Document upload / list / delete service helpers (per-user).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, type Document } from "@/lib/db/schema";
import { clearAskCache } from "@/services/ask/cache";
import {
  ALLOWED_EXTENSIONS,
  isAllowedUpload,
} from "@/services/documents/extract";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export type DocumentListItem = {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: Document["status"];
  statusMessage: string | null;
  error: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

function toListItem(doc: Document): DocumentListItem {
  return {
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    status: doc.status,
    statusMessage: doc.statusMessage,
    error: doc.error,
    chunkCount: doc.chunkCount,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export function getAllowedExtensions(): readonly string[] {
  return ALLOWED_EXTENSIONS;
}

export function getMaxUploadBytes(): number {
  return MAX_FILE_BYTES;
}

export async function listDocuments(
  userId: string,
): Promise<DocumentListItem[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt));
  return rows.map(toListItem);
}

export async function getDocument(
  id: string,
  userId: string,
): Promise<DocumentListItem | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  return row ? toListItem(row) : null;
}

export type CreateDocumentInput = {
  userId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export type CreateDocumentResult = {
  document: DocumentListItem;
};

/**
 * Persist uploaded file + create a documents row (status=uploaded).
 * Caller should kick off processDocument in the background.
 */
export async function createDocumentFromUpload(
  input: CreateDocumentInput,
): Promise<CreateDocumentResult> {
  const filename = path.basename(input.filename).trim();
  if (!filename) {
    throw new Error("Filename is required.");
  }

  if (!isAllowedUpload(filename, input.mimeType)) {
    throw new Error(
      `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }

  if (input.buffer.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }

  if (input.buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(
      `File is too large. Maximum size is ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB.`,
    );
  }

  await ensureUploadDir();

  const db = getDb();
  const [created] = await db
    .insert(documents)
    .values({
      userId: input.userId,
      filename,
      mimeType: input.mimeType || "application/octet-stream",
      fileSize: input.buffer.byteLength,
      storagePath: "", // filled after we know the id
      status: "uploaded",
      statusMessage: "Queued for processing…",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create document record.");
  }

  const storagePath = path.join(
    UPLOAD_DIR,
    `${created.id}${path.extname(filename)}`,
  );
  await fs.writeFile(storagePath, input.buffer);

  const [updated] = await db
    .update(documents)
    .set({ storagePath, updatedAt: new Date() })
    .where(eq(documents.id, created.id))
    .returning();

  return { document: toListItem(updated ?? { ...created, storagePath }) };
}

/**
 * Permanently delete a document, its chunks (CASCADE), and the stored file.
 */
export async function deleteDocument(
  id: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);

  if (!existing) {
    return false;
  }

  await db.delete(documents).where(eq(documents.id, id));

  if (existing.storagePath) {
    try {
      await fs.unlink(existing.storagePath);
    } catch {
      // File may already be gone.
    }
  }

  await clearAskCache(userId);
  return true;
}

/**
 * Reset a failed/uploaded document into the processing queue.
 */
export async function queueDocumentReprocess(
  id: string,
  userId: string,
): Promise<DocumentListItem | null> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);

  if (!existing) {
    return null;
  }

  const [updated] = await db
    .update(documents)
    .set({
      status: "uploaded",
      statusMessage: "Queued for reprocessing…",
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))
    .returning();

  return updated ? toListItem(updated) : toListItem(existing);
}
