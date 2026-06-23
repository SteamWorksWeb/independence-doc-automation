/**
 * src/proxy.ts
 *
 * Next.js 16 Proxy — Admin Route Protection
 * (Migrated from src/middleware.ts per Next.js 16 convention)
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

// ── Proxy handler ─────────────────────────────────────────────────────────────
export async function proxy(request: NextRequest): Promise<NextResponse> {
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
    console.error(
      "[proxy] ADMIN_JWT_SECRET is not set. " +
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
        issuer: "independence-law-admin",
        algorithms: ["HS256"],
      }
    );

    // ── 5. Assert role claim ──────────────────────────────────────────────
    if (payload.role !== "admin") {
      console.warn(
        `[proxy] Token with unexpected role "${payload.role}" rejected`
      );
      return denyAccess(request, "wrong_role");
    }

    // ── 6. Request is authenticated — pass through ────────────────────────
    const response = NextResponse.next();
    if (typeof payload.email === "string") {
      response.headers.set("x-admin-email", payload.email);
    }
    return response;
  } catch {
    return denyAccess(request, "invalid_token");
  }
}

// ── Helper: clear cookie + redirect ──────────────────────────────────────────

function denyAccess(request: NextRequest, reason: string): NextResponse {
  console.warn(`[proxy] Access denied (${reason}): ${request.nextUrl.pathname}`);

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
