import {
  AuthError,
  authenticateUser,
  createSessionToken,
  setSessionCookie,
  toPublicUser,
  validateAuthInput,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/login — verify credentials + set session cookie.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    };
    const { email, password } = validateAuthInput(body);
    const user = await authenticateUser({ email, password });
    const token = await createSessionToken(user);
    await setSessionCookie(token);
    return Response.json({ user: toPublicUser(user) });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Login failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
