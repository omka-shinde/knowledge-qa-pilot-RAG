import { after } from "next/server";
import {
  deleteDocument,
  getDocument,
  processDocument,
  queueDocumentReprocess,
} from "@/services/documents";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/documents/[id] — single document status (for polling).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const document = await getDocument(id);
    if (!document) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }
    return Response.json({ document });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load document.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/documents/[id] — retry processing for a failed/uploaded document.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const document = await getDocument(id);
    if (!document) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    if (document.status === "ready") {
      return Response.json({ document });
    }

    if (
      document.status === "extracting" ||
      document.status === "chunking" ||
      document.status === "embedding"
    ) {
      return Response.json(
        { error: "Document is already processing.", document },
        { status: 409 },
      );
    }

    const queued = await queueDocumentReprocess(id);
    after(async () => {
      await processDocument(id);
    });

    return Response.json({ document: queued });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retry processing.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[id] — permanently remove document + chunks.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = await deleteDocument(id);
    if (!deleted) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete document.";
    return Response.json({ error: message }, { status: 500 });
  }
}
