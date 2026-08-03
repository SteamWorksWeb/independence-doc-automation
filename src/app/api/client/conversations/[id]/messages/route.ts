/**
 * src/app/api/client/conversations/[id]/messages/route.ts
 *
 * GET  /api/client/conversations/[id]/messages
 *   Server-side proxy → GET <backend>/client/conversations/:id/messages
 *
 * POST /api/client/conversations/[id]/messages
 *   Server-side proxy → POST <backend>/client/conversations/:id/messages
 *   Body: { body: string; attachmentKey?: string }
 *
 * Auth: reads HttpOnly borrower_session / client_token cookie.
 * Mirrors the pattern in /api/admin/conversations/[id]/messages/route.ts.
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
// GET /api/client/conversations/[id]/messages
// =============================================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const token = await getClientToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized: No active client session." }, { status: 401 });
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[proxy/client/conversations/[id]/messages GET] NEXT_PUBLIC_AWS_API_URL not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  const backendUrl = `${backendBase}/client/conversations/${encodeURIComponent(id)}/messages`;
  console.log("[proxy/client/conversations/[id]/messages GET] →", backendUrl);

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
        `[proxy/client/conversations/[id]/messages GET] Backend ${res.status} | body: ${rawBody}`
      );
      return NextResponse.json(
        { message: `Backend error ${res.status}`, detail: rawBody },
        { status: res.status }
      );
    }

    const data: unknown = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[proxy/client/conversations/[id]/messages GET] Network error:", err);
    return NextResponse.json(
      { message: "Unable to load messages. Please try again." },
      { status: 502 }
    );
  }
}

// =============================================================================
// POST /api/client/conversations/[id]/messages
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const token = await getClientToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized: No active client session." }, { status: 401 });
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[proxy/client/conversations/[id]/messages POST] NEXT_PUBLIC_AWS_API_URL not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const backendUrl = `${backendBase}/client/conversations/${encodeURIComponent(id)}/messages`;
  console.log("[proxy/client/conversations/[id]/messages POST] →", backendUrl);

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
        `[proxy/client/conversations/[id]/messages POST] Backend ${res.status} | body: ${rawBody}`
      );
      return NextResponse.json(
        { message: `Backend error ${res.status}`, detail: rawBody },
        { status: res.status }
      );
    }

    const data: unknown = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[proxy/client/conversations/[id]/messages POST] Network error:", err);
    return NextResponse.json(
      { message: "Failed to send message. Please try again." },
      { status: 502 }
    );
  }
}
