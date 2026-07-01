/**
 * src/middleware.ts
 *
 * Next.js Edge Middleware — Unified Route Protection
 *
 * Guards two distinct route segments with separate auth layers:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  /admin/*   →  Admin guard (admin_session cookie + role assertion)  │
 * │  /dashboard/*  →  Client guard (client_token cookie, JWT verify)    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Admin Guard (/admin/*)  ──────────────────────────────────────────────────
 *  Matches: /admin/:path*   Excludes: /admin/login (public auth gateway)
 *  Cookie: "admin_session" (HttpOnly)
 *  Secret: ADMIN_JWT_SECRET env var
 *  Claims: issuer === "independence-law-admin", role === "admin"
 *  On failure: delete stale cookie, redirect to /admin/login (never reveal reason)
 *
 * ── Client Guard (/dashboard/*)  ────────────────────────────────────────────
 *  Matches: /dashboard/:path*
 *  Cookie: "client_token" (httpOnly)
 *  Secret: JWT_SECRET env var (must match backend JWT_SECRET exactly)
 *  Verifies: signature only — payload is NOT trusted for access control
 *            per backend contract: "always validate the token server-side"
 *  On missing: redirect to /login?next={pathname}
 *  On invalid/expired: delete stale cookie, redirect to /login?reason=session_expired
 *
 * Security notes:
 *  - jose runs natively on the Edge — no Node.js APIs required
 *  - Secrets are never exposed to the client
 *  - A valid client cookie cannot pass the admin gate (different secret + role check)
 *  - Both cookies are HttpOnly — JS on the page cannot read or forge them
 *  - jwtVerify() handles expiry, signature, and algorithm validation
 */

import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

// ── Matcher: admin routes + client dashboard + onboarding ────────────────────
export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/onboarding/:path*"],
};

// ── Unified middleware handler ─────────────────────────────────────────────────
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Route to the appropriate guard based on the path prefix
  if (pathname.startsWith("/admin")) {
    return handleAdminRoute(request, pathname);
  }

  if (pathname.startsWith("/dashboard")) {
    return handleClientRoute(request, pathname);
  }

  // Fallback — should never be reached given the matcher above
  return NextResponse.next();
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN GUARD — /admin/*
// ══════════════════════════════════════════════════════════════════════════════

async function handleAdminRoute(
  request: NextRequest,
  pathname: string
): Promise<NextResponse> {
  // ── 1. Check for an existing valid admin session ───────────────────────────
  const cookie = request.cookies.get("admin_session");
  const secret = process.env.ADMIN_JWT_SECRET;

  let isAuthenticated = false;

  if (cookie?.value && secret) {
    try {
      const { payload } = await jwtVerify(
        cookie.value,
        new TextEncoder().encode(secret),
        {
          issuer: "independence-law-admin",
          algorithms: ["HS256"],
        }
      );
      if (payload.role === "admin") {
        isAuthenticated = true;
      }
    } catch {
      // Token invalid — treat as unauthenticated
    }
  }

  // ── 2. Authenticated admin on the login page or bare /admin root
  //        → send them straight to /admin/dashboard (skip login)  ─────────────
  if (isAuthenticated) {
    if (
      pathname === "/admin" ||
      pathname === "/admin/" ||
      pathname === "/admin/login" ||
      pathname.startsWith("/admin/login/")
    ) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  // ── 3. Pass-through the login page for unauthenticated visitors ────────────
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  // ── 4. Bare /admin root with no valid session → redirect to login ──────────
  if (pathname === "/admin" || pathname === "/admin/") {
    return denyAdmin(request, "no_session_root");
  }

  // ── 5. Pass-through Next.js API routes (proxy routes handle their own auth) ─
  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  // ── 6. All other /admin/* routes: require a valid session ──────────────────
  if (!isAuthenticated) {
    return denyAdmin(request, cookie?.value ? "invalid_token" : "no_cookie");
  }

  // ── 7. Request is authenticated — pass through ─────────────────────────────
  const response = NextResponse.next();
  // Forward admin email as a header so server components can read it
  try {
    if (cookie?.value && secret) {
      const { payload } = await jwtVerify(
        cookie.value,
        new TextEncoder().encode(secret),
        { issuer: "independence-law-admin", algorithms: ["HS256"] }
      );
      if (typeof payload.email === "string") {
        response.headers.set("x-admin-email", payload.email);
      }
    }
  } catch { /* ignore — already validated above */ }

  return response;
}

/** Clear admin cookie and redirect to /admin/login */
function denyAdmin(request: NextRequest, reason: string): NextResponse {
  console.warn(`[middleware] Admin access denied (${reason}): ${request.nextUrl.pathname}`);

  const loginUrl = new URL("/admin/login", request.url);
  const response = NextResponse.redirect(loginUrl);

  response.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/admin",
    expires: new Date(0),
  });

  return response;
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENT GUARD — /dashboard/*
// ══════════════════════════════════════════════════════════════════════════════

const CLIENT_COOKIE_NAME = "client_token";
const CLIENT_LOGIN_PATH = "/login";

async function handleClientRoute(
  request: NextRequest,
  pathname: string
): Promise<NextResponse> {
  // ── 1. Read the JWT cookie ─────────────────────────────────────────────────
  const token = request.cookies.get(CLIENT_COOKIE_NAME)?.value;

  // ── 2. No token — redirect to /login with ?next= for post-login return ─────
  if (!token) {
    const loginUrl = new URL(CLIENT_LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 3. Load JWT_SECRET ────────────────────────────────────────────────────
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    // Configuration error — fail safe: redirect rather than allow unguarded access
    console.error(
      "[middleware] JWT_SECRET is not set. Cannot verify client tokens."
    );
    const loginUrl = new URL(CLIENT_LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 4. Verify JWT signature ────────────────────────────────────────────────
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    // jwtVerify throws on invalid signature, expired token, malformed JWT, etc.
    // We verify signature only — payload not trusted for access control.
    await jwtVerify(token, secret);

    // Token is valid — allow the request through
    return NextResponse.next();
  } catch {
    // Token invalid or expired — clear the stale cookie and redirect
    const loginUrl = new URL(CLIENT_LOGIN_PATH, request.url);
    loginUrl.searchParams.set("reason", "session_expired");

    const response = NextResponse.redirect(loginUrl);

    // Delete the invalid cookie so the client doesn't keep sending it
    response.cookies.delete(CLIENT_COOKIE_NAME);

    return response;
  }
}
