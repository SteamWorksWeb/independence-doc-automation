/**
 * src/app/api/auth/admin-logout/route.ts
 *
 * POST /api/auth/admin-logout
 *
 * Destroys the admin_session cookie and redirects to /admin/login.
 * This is the only way to end an admin session.
 *
 * Uses POST (not GET) to prevent CSRF via prefetching or link clicks.
 * The dashboard logout button must submit a form or send a fetch POST.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const loginUrl = `${baseUrl}/admin/login`;

  const response = NextResponse.redirect(loginUrl, { status: 303 });

  // Clear the admin session cookie — same attributes as when it was set
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/admin",
    expires: new Date(0),
  });

  console.log("[admin-logout] Session cleared");
  return response;
}

// Block GET to prevent accidental logout via link prefetch
export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
