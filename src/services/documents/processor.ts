/**
 * Background pipeline: extract → chunk → embed → store.
 * Updates document.status so the UI can poll progress.
 */

import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  documentChunks,
  documents,
  type DocumentStatus,
} from "@/lib/db/schema";
import { chunkText } from "@/services/documents/chunker";
import { embedTexts } from "@/services/documents/embeddings";
import { extractTextFromFile } from "@/services/documents/extract";
import { clearAskCache } from "@/services/ask/cache";

async function setStatus(
  documentId: string,
  status: DocumentStatus,
  extras?: {
    statusMessage?: string | null;
    error?: string | null;
    chunkCount?: number;
  },
): Promise<void> {
  const db = getDb();
  await db
    .update(documents)
    .set({
      status,
      statusMessage: extras?.statusMessage ?? null,
      error: extras?.error ?? null,
      ...(extras?.chunkCount !== undefined
        ? { chunkCount: extras.chunkCount }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
}

/**
 * Process an uploaded document end-to-end.
 * Safe to call from `after()` — errors are written to the document row.
 */
export async function processDocument(documentId: string): Promise<void> {
  const db = getDb();

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    return;
  }

  try {
    await setStatus(documentId, "extracting", {
      statusMessage: "Extracting text from document…",
    });

    const buffer = await fs.readFile(doc.storagePath);
    const text = await extractTextFromFile(buffer, doc.filename);
    const cleaned = text.replace(/\s+/g, " ").trim();

    if (!cleaned) {
      throw new Error(
        "No extractable text found. Scanned/image-only PDFs are not supported yet.",
      );
    }

    await setStatus(documentId, "chunking", {
      statusMessage: "Splitting text into chunks…",
    });

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("Chunking produced no content.");
    }

    await setStatus(documentId, "embedding", {
      statusMessage: `Creating embeddings for ${chunks.length} chunks…`,
      chunkCount: chunks.length,
    });

    // Replace any previous chunks (e.g. retry).
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, documentId));

    const embeddings = await embedTexts(chunks.map((c) => c.content));

    await db.insert(documentChunks).values(
      chunks.map((chunk, i) => ({
        documentId,
        chunkIndex: chunk.index,
        content: chunk.content,
        tokenEstimate: chunk.tokenEstimate,
        embedding: embeddings[i]!,
      })),
    );

    await setStatus(documentId, "ready", {
      statusMessage: `Ready — ${chunks.length} chunks indexed`,
      chunkCount: chunks.length,
      error: null,
    });

    // Document corpus changed — drop stale ask answers.
    await clearAskCache();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document processing failed.";
    await setStatus(documentId, "failed", {
      statusMessage: "Processing failed",
      error: message,
    });
  }
}
