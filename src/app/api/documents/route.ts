import { after } from "next/server";
import {
  createDocumentFromUpload,
  getAllowedExtensions,
  getMaxUploadBytes,
  listDocuments,
  processDocument,
} from "@/services/documents";

export const runtime = "nodejs";

/**
 * GET /api/documents — list uploaded documents + processing status.
 */
export async function GET() {
  try {
    const documents = await listDocuments();
    return Response.json({
      documents,
      allowedExtensions: getAllowedExtensions(),
      maxFileBytes: getMaxUploadBytes(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list documents.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/documents — upload a document (multipart form field: file).
 * Processing (extract → chunk → embed) runs in the background via `after()`.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: 'Expected multipart field "file".' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { document } = await createDocumentFromUpload({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    after(async () => {
      await processDocument(document.id);
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed.";
    const status = /unsupported|too large|empty|required/i.test(message)
      ? 400
      : 500;
    return Response.json({ error: message }, { status });
  }
}
