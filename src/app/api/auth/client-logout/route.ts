/**
 * src/app/api/auth/client-logout/route.ts
 *
 * POST /api/auth/client-logout
 *
 * Clears the client_token HttpOnly cookie and redirects to /login.
 * Uses POST method (not GET) to prevent CSRF via prefetch/link.
 */

import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"),
    303 // See Other — browser re-fetches as GET
  );

  // Clear the client_token cookie
  response.cookies.set("client_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0, // Expire immediately
    path: "/",
  });

  return response;
}

// Block all other methods
export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
