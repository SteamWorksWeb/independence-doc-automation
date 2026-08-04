/**
 * src/app/api/auth/client-logout/route.ts
 *
 * POST /api/auth/client-logout
 *
 * Clears borrower HttpOnly session cookies and redirects to /login.
 * Uses POST method (not GET) to prevent CSRF via prefetch/link.
 */

import { NextResponse } from "next/server";

const BORROWER_SESSION_COOKIE_NAMES = ["borrower_session", "client_token", "borrower_email"] as const;

export async function POST() {
  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"),
    303 // See Other — browser re-fetches as GET
  );

  for (const cookieName of BORROWER_SESSION_COOKIE_NAMES) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
  }

  return response;
}

// Block all other methods
export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
