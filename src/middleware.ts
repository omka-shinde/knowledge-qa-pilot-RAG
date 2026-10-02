import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "qa_pilot_session";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
];

function getAuthSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "";
  const fallback = "qa-pilot-dev-auth-secret-change-me";
  return new TextEncoder().encode(
    secret.length >= 16 ? secret : fallback,
  );
}

/** Send the visitor back to the same path, including ?thread=, after login. */
function loginRedirect(request: NextRequest): URL {
  const login = new URL("/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (nextPath !== "/") {
    login.searchParams.set("next", nextPath);
  }
  return login;
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // Next internals / static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(?:ico|png|jpg|jpeg|svg|css|js|map)$/)
  ) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    // Logged-in users hitting login/register → home
    if (pathname === "/login" || pathname === "/register") {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      if (token) {
        try {
          await jwtVerify(token, getAuthSecret());
          return NextResponse.redirect(new URL("/", request.url));
        } catch {
          // invalid token — allow auth pages
        }
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.redirect(loginRedirect(request));
  }

  try {
    await jwtVerify(token, getAuthSecret());
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const response = NextResponse.redirect(loginRedirect(request));
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next static files handled above via isPublic.
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
