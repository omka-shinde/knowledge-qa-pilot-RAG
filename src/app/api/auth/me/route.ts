import { getSessionUser, toPublicUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/auth/me — current session user (or null).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }
  return Response.json({ user: toPublicUser(user) });
}
