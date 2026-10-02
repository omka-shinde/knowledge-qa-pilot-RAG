import { AuthError, requireSessionUser } from "@/lib/auth";
import { getSuggestionsForUser } from "@/services/documents/suggestions";

export const runtime = "nodejs";

/**
 * GET /api/suggestions — questions drawn from the current user's documents.
 */
export async function GET() {
  try {
    const user = await requireSessionUser();
    const suggestions = await getSuggestionsForUser(user.id);
    return Response.json(suggestions);
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to load suggestions.";
    return Response.json({ error: message }, { status: 500 });
  }
}
