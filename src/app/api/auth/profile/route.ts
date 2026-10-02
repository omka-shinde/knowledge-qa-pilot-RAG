import {
  AuthError,
  createSessionToken,
  requireSessionUser,
  setSessionCookie,
  toPublicUser,
  updateUserProfile,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * PATCH /api/auth/profile — update name and/or password.
 */
export async function PATCH(request: Request) {
  try {
    const session = await requireSessionUser();
    const body = (await request.json()) as {
      name?: unknown;
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    const user = await updateUserProfile(session.id, body);
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
    const message =
      error instanceof Error ? error.message : "Failed to update profile.";
    return Response.json({ error: message }, { status: 500 });
  }
}
