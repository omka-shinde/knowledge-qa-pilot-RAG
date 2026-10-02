import {
  AuthError,
  authenticateUser,
  createSessionToken,
  createUser,
  setSessionCookie,
  toPublicUser,
  validateAuthInput,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/register — create account + set session cookie.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };
    const { name, email, password } = validateAuthInput({
      ...body,
      requireName: true,
    });

    const user = await createUser({
      name: name!,
      email,
      password,
    });
    const token = await createSessionToken(user);
    await setSessionCookie(token);

    return Response.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Registration failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
