/**
 * src/app/api/admin/super-admin/staff/route.ts
 *
 * GET /api/admin/super-admin/staff
 *
 * Server-side proxy for GET /api/v1/super-admin/staff on the backend.
 * Reads the HttpOnly admin_session cookie and forwards it as a Bearer token.
 *
 * Access: SUPER_ADMIN only (enforced at middleware AND backend levels).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  // ── 1. Read admin session cookie ──────────────────────────────────────────
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  // ── 2. Resolve backend URL ─────────────────────────────────────────────────
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error("[proxy/super-admin/staff] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  const targetUrl = `${backendBase}/api/v1/super-admin/staff`;

  // ── 3. Forward to backend ──────────────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/super-admin/staff] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // ── 4. Parse and relay ─────────────────────────────────────────────────────
  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    return NextResponse.json(
      { message: "Unexpected response from backend." },
      { status: 502 }
    );
  }

  return NextResponse.json(data, { status: backendRes.status });
}

export function POST() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
