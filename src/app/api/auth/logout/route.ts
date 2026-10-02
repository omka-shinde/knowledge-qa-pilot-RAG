import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout — clear session cookie.
 */
export async function POST() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
