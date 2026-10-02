import { AuthError, requireSessionUser } from "@/lib/auth";
import { createThread, listThreads } from "@/services/chat/threads";

export const runtime = "nodejs";

/**
 * GET /api/threads — list current user's chat threads.
 */
export async function GET() {
  try {
    const user = await requireSessionUser();
    const threads = await listThreads(user.id);
    return Response.json({ threads });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to list threads.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/threads — create a new empty chat thread.
 */
export async function POST() {
  try {
    const user = await requireSessionUser();
    const thread = await createThread(user.id);
    return Response.json({ thread }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to create thread.";
    return Response.json({ error: message }, { status: 500 });
  }
}
