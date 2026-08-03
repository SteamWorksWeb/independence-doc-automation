/**
 * src/app/api/admin/super-admin/staff/invite/route.ts
 *
 * POST /api/admin/super-admin/staff/invite
 *
 * Server-side proxy for POST /api/v1/super-admin/staff/invite on the backend.
 * Reads the HttpOnly admin_session cookie and forwards it as a Bearer token.
 *
 * Expected body: { email: string; firstName: string; lastName: string }
 *
 * Access: SUPER_ADMIN only (enforced at middleware AND backend levels).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  // ── 1. Read admin session cookie ──────────────────────────────────────────
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  // ── 2. Parse request body ──────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  // ── 3. Resolve backend URL ─────────────────────────────────────────────────
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error("[proxy/super-admin/staff/invite] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  const targetUrl = `${backendBase}/api/v1/super-admin/staff/invite`;

  // ── 4. Forward to backend ──────────────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/super-admin/staff/invite] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // ── 5. Parse and relay ─────────────────────────────────────────────────────
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

export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
