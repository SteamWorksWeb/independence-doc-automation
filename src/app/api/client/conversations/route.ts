/**
 * src/app/api/client/conversations/route.ts
 *
 * GET  /api/client/conversations
 *   Server-side proxy → GET <backend>/client/conversations
 *   Returns the client's own conversation (thread with their attorney).
 *
 * POST /api/client/conversations
 *   Server-side proxy → POST <backend>/client/conversations
 *   Find-or-create the client's conversation thread.
 *
 * Auth: reads HttpOnly borrower_session / client_token cookie.
 * Mirrors the pattern in /api/admin/conversations/route.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BORROWER_SESSION_COOKIE_NAMES = ["borrower_session", "client_token"] as const;

async function getClientToken(): Promise<string | null> {
  const cookieStore = await cookies();
  for (const name of BORROWER_SESSION_COOKIE_NAMES) {
    const token = cookieStore.get(name)?.value;
    if (token) return token;
  }
  return null;
}

function getBackendBase(): string | null {
  return process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "") ?? null;
}

// =============================================================================
// GET /api/client/conversations
// =============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = await getClientToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized: No active client session." }, { status: 401 });
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[proxy/client/conversations GET] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const backendUrl = `${backendBase}/client/conversations${qs ? `?${qs}` : ""}`;

  console.log("[proxy/client/conversations GET] → backend URL:", backendUrl);

  try {
    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "<unreadable>");
      console.error(
        `[proxy/client/conversations GET] Backend responded ${res.status} | body: ${rawBody}`
      );
      return NextResponse.json(
        { message: `Backend error ${res.status}`, detail: rawBody },
        { status: res.status }
      );
    }

    const data: unknown = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[proxy/client/conversations GET] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }
}

// =============================================================================
// POST /api/client/conversations
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = await getClientToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized: No active client session." }, { status: 401 });
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[proxy/client/conversations POST] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const backendUrl = `${backendBase}/client/conversations`;
  console.log("[proxy/client/conversations POST] → backend URL:", backendUrl);

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "<unreadable>");
      console.error(
        `[proxy/client/conversations POST] Backend responded ${res.status} | body: ${rawBody}`
      );
      return NextResponse.json(
        { message: `Backend error ${res.status}`, detail: rawBody },
        { status: res.status }
      );
    }

    const data: unknown = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[proxy/client/conversations POST] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }
}
