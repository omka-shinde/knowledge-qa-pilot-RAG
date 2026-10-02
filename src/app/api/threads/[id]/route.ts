import { AuthError, requireSessionUser } from "@/lib/auth";
import {
  deleteThread,
  getThreadForUser,
  renameThread,
} from "@/services/chat/threads";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/threads/[id] — thread + full message history.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;
    const thread = await getThreadForUser(id, user.id);
    if (!thread) {
      return Response.json({ error: "Thread not found." }, { status: 404 });
    }
    return Response.json({ thread });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to load thread.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/threads/[id] — rename thread.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;
    const body = (await request.json()) as { title?: unknown };
    if (typeof body.title !== "string") {
      return Response.json({ error: "title is required." }, { status: 400 });
    }
    const thread = await renameThread(id, user.id, body.title);
    if (!thread) {
      return Response.json({ error: "Thread not found." }, { status: 404 });
    }
    return Response.json({ thread });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to rename thread.";
    const status = /required/i.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/threads/[id] — delete thread + messages.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;
    const deleted = await deleteThread(id, user.id);
    if (!deleted) {
      return Response.json({ error: "Thread not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to delete thread.";
    return Response.json({ error: message }, { status: 500 });
  }
}
