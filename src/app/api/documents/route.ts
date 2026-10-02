import { after } from "next/server";
import { AuthError, requireSessionUser } from "@/lib/auth";
import {
  createDocumentFromUpload,
  getAllowedExtensions,
  getMaxUploadBytes,
  listDocuments,
  processDocument,
} from "@/services/documents";

export const runtime = "nodejs";

/**
 * GET /api/documents — list current user's documents + processing status.
 */
export async function GET() {
  try {
    const user = await requireSessionUser();
    const documents = await listDocuments(user.id);
    return Response.json({
      documents,
      allowedExtensions: getAllowedExtensions(),
      maxFileBytes: getMaxUploadBytes(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to list documents.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/documents — upload a document for the current user.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
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
      userId: user.id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    after(async () => {
      await processDocument(document.id);
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Upload failed.";
    const status = /unsupported|too large|empty|required/i.test(message)
      ? 400
      : 500;
    return Response.json({ error: message }, { status });
  }
}
