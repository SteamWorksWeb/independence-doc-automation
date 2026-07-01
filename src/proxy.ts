/**
 * src/proxy.ts
 *
 * Next.js 16 Proxy — Unified Route Protection
 * (Next.js 16 uses proxy.ts instead of middleware.ts as the edge interceptor)
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


// ── Unified proxy handler ─────────────────────────────────────────────────────
export async function proxy(request: NextRequest): Promise<NextResponse> {
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
  // ── 1. Pass-through the login page itself ──────────────────────────────────
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  // ── 2. Check for cookie presence ──────────────────────────────────────────
  const cookie = request.cookies.get("admin_session");

  if (!cookie?.value) {
    return denyAdmin(request, "no_cookie");
  }

  // ── 3. Load ADMIN_JWT_SECRET ───────────────────────────────────────────────
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    console.error(
      "[proxy] ADMIN_JWT_SECRET is not set. " +
        "Configure it in your environment variables."
    );
    return denyAdmin(request, "config_error");
  }

  // ── 4. Cryptographically verify the JWT ───────────────────────────────────
  try {
    const { payload } = await jwtVerify(
      cookie.value,
      new TextEncoder().encode(secret),
      {
        issuer: "independence-law-admin",
        algorithms: ["HS256"],
      }
    );

    // ── 5. Assert role claim ─────────────────────────────────────────────────
    if (payload.role !== "admin") {
      console.warn(
        `[proxy] Token with unexpected role "${payload.role}" rejected`
      );
      return denyAdmin(request, "wrong_role");
    }

    // ── 6. Request is authenticated — pass through ───────────────────────────
    const response = NextResponse.next();
    if (typeof payload.email === "string") {
      response.headers.set("x-admin-email", payload.email);
    }
    return response;
  } catch {
    return denyAdmin(request, "invalid_token");
  }
}

/** Clear admin cookie and redirect to /admin/login */
function denyAdmin(request: NextRequest, reason: string): NextResponse {
  console.warn(`[proxy] Admin access denied (${reason}): ${request.nextUrl.pathname}`);

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
      "[proxy] JWT_SECRET is not set. Cannot verify client tokens."
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
