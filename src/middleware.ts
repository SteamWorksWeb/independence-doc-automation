/**
 * src/middleware.ts
 *
 * Next.js Edge Middleware — Admin Route Protection
 *
 * Matches:  /admin/:path*  (all admin routes)
 * Excludes: /admin/login   (the auth gateway itself)
 *
 * Verification flow:
 * 1. Intercept every request to /admin/*
 * 2. Skip /admin/login (public)
 * 3. Read the "admin_session" HttpOnly cookie
 * 4. Cryptographically verify the JWT with ADMIN_JWT_SECRET using jose
 *    (jose runs natively on the Edge — no Node.js APIs required)
 * 5. Assert role === "admin" and issuer === "independence-law-admin"
 * 6. On ANY failure (missing, expired, tampered, wrong role):
 *    — Delete the stale cookie
 *    — Redirect to /admin/login
 *    — Never reveal the reason to the client
 *
 * Security notes:
 * - ADMIN_JWT_SECRET is never exposed to the client
 * - A valid CLIENT session cookie cannot pass this gate (different secret + role)
 * - The cookie is HttpOnly so JS on the page cannot read or forge it
 * - jwtVerify() handles expiry, signature, and algorithm validation
 */

import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

// ── Matcher: only admin routes ────────────────────────────────────────────────
export const config = {
  matcher: ["/admin/:path*"],
};

// ── Middleware handler ────────────────────────────────────────────────────────
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // ── 1. Pass-through the login page itself ────────────────────────────────
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  // ── 2. Check for cookie presence ─────────────────────────────────────────
  const cookie = request.cookies.get("admin_session");

  if (!cookie?.value) {
    return denyAccess(request, "no_cookie");
  }

  // ── 3. Load ADMIN_JWT_SECRET ──────────────────────────────────────────────
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    // Misconfigured server — deny access, log on the Edge
    console.error(
      "[middleware] ADMIN_JWT_SECRET is not set. " +
        "Configure it in your environment variables."
    );
    return denyAccess(request, "config_error");
  }

  // ── 4. Cryptographically verify the JWT ──────────────────────────────────
  try {
    const { payload } = await jwtVerify(
      cookie.value,
      new TextEncoder().encode(secret),
      {
        // These options MUST match what admin-login/route.ts signs with
        issuer: "independence-law-admin",
        algorithms: ["HS256"],
      }
    );

    // ── 5. Assert role claim ──────────────────────────────────────────────
    // A client JWT (signed with NEXTAUTH_SECRET, role: "client") would
    // fail here even if someone found the admin cookie name.
    if (payload.role !== "admin") {
      console.warn(
        `[middleware] Token with unexpected role "${payload.role}" rejected`
      );
      return denyAccess(request, "wrong_role");
    }

    // ── 6. Request is authenticated — pass through ────────────────────────
    // Optionally forward the admin email as a request header for use
    // in server components (never exposed to client JS)
    const response = NextResponse.next();
    if (typeof payload.email === "string") {
      response.headers.set("x-admin-email", payload.email);
    }
    return response;
  } catch {
    // jwtVerify throws on: expired, bad signature, wrong algorithm, malformed
    return denyAccess(request, "invalid_token");
  }
}

// ── Helper: clear cookie + redirect ──────────────────────────────────────────

function denyAccess(
  request: NextRequest,
  reason: string
): NextResponse {
  // Log server-side only — client never sees the reason
  console.warn(`[middleware] Access denied (${reason}): ${request.nextUrl.pathname}`);

  const loginUrl = new URL("/admin/login", request.url);

  const response = NextResponse.redirect(loginUrl);

  // Aggressively clear any stale/tampered cookie
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
