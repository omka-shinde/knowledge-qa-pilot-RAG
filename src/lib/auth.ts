/**
 * Auth helpers: password hashing + signed session cookies (jose).
 */

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";

export const SESSION_COOKIE = "qa_pilot_session";
const SESSION_DAYS = 14;
const BCRYPT_ROUNDS = 12;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
};

function getAuthSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "";
  if (!secret || secret.length < 16) {
    // Dev fallback — set AUTH_SECRET in production.
    const fallback = "qa-pilot-dev-auth-secret-change-me";
    return new TextEncoder().encode(
      process.env.NODE_ENV === "production" ? secret || fallback : fallback,
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateAuthInput(input: {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  requireName?: boolean;
}): { email: string; password: string; name?: string } {
  if (typeof input.email !== "string" || !input.email.trim()) {
    throw new AuthError("Email is required.", 400);
  }
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("Enter a valid email address.", 400);
  }

  if (typeof input.password !== "string" || !input.password) {
    throw new AuthError("Password is required.", 400);
  }
  if (input.password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.", 400);
  }

  let name: string | undefined;
  if (input.requireName) {
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw new AuthError("Name is required.", 400);
    }
    name = input.name.trim();
    if (name.length > 100) {
      throw new AuthError("Name must be at most 100 characters.", 400);
    }
  }

  return { email, password: input.password, name };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function createSessionToken(
  user: Pick<User, "id" | "email" | "name">,
): Promise<string> {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);

  return new SignJWT({
    email: user.email,
    name: user.name,
  } satisfies Omit<SessionPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(getAuthSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const name = typeof payload.name === "string" ? payload.name : null;
    if (!sub || !email || !name) {
      return null;
    }
    return { sub, email, name };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const payload = await verifySessionToken(token);
  if (!payload) {
    return null;
  }
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("You must be logged in.", 401);
  }
  return user;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  return row ?? null;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<SessionUser> {
  const email = normalizeEmail(input.email);
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AuthError("An account with this email already exists.", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const db = getDb();
  const [created] = await db
    .insert(users)
    .values({
      name: input.name.trim(),
      email,
      passwordHash,
    })
    .returning();

  if (!created) {
    throw new AuthError("Failed to create account.", 500);
  }

  return {
    id: created.id,
    name: created.name,
    email: created.email,
  };
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<SessionUser> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new AuthError("Invalid email or password.", 401);
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new AuthError("Invalid email or password.", 401);
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export function toPublicUser(user: SessionUser): SessionUser {
  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/**
 * Update display name and/or password for the current user.
 * Password change requires the current password.
 */
export async function updateUserProfile(
  userId: string,
  input: {
    name?: unknown;
    currentPassword?: unknown;
    newPassword?: unknown;
  },
): Promise<SessionUser> {
  const existing = await findUserById(userId);
  if (!existing) {
    throw new AuthError("User not found.", 404);
  }

  const updates: { name?: string; passwordHash?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw new AuthError("Name is required.", 400);
    }
    const name = input.name.trim();
    if (name.length > 100) {
      throw new AuthError("Name must be at most 100 characters.", 400);
    }
    updates.name = name;
  }

  const wantsPasswordChange =
    input.newPassword !== undefined &&
    input.newPassword !== null &&
    String(input.newPassword).length > 0;

  if (wantsPasswordChange) {
    if (typeof input.currentPassword !== "string" || !input.currentPassword) {
      throw new AuthError("Current password is required to set a new password.", 400);
    }
    if (typeof input.newPassword !== "string") {
      throw new AuthError("New password is required.", 400);
    }
    if (input.newPassword.length < 8) {
      throw new AuthError("New password must be at least 8 characters.", 400);
    }
    const ok = await verifyPassword(
      input.currentPassword,
      existing.passwordHash,
    );
    if (!ok) {
      throw new AuthError("Current password is incorrect.", 401);
    }
    updates.passwordHash = await hashPassword(input.newPassword);
  }

  if (!updates.name && !updates.passwordHash) {
    throw new AuthError("Nothing to update.", 400);
  }

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new AuthError("Failed to update profile.", 500);
  }

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
  };
}
