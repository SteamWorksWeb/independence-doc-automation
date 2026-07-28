/**
 * src/app/api/admin/conversations/route.ts
 *
 * GET  /api/admin/conversations?borrowerId=<uuid>
 *   Server-side proxy → GET /api/v1/conversations?borrowerId=<uuid>
 *
 * POST /api/admin/conversations
 *   Server-side proxy → POST /api/v1/conversations
 *   Body: { borrowerId: string }
 *   Idempotent find-or-create: returns the existing or newly-created
 *   conversation record. Backend returns 200 (existing) or 201 (new).
 *
 * Auth: All routes read the HttpOnly admin_session cookie — browser JS never
 * touches the JWT directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value ?? null;
}

function getBackendBase(): string | null {
  return process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "") ?? null;
}

// =============================================================================
// GET /api/admin/conversations
// =============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[proxy/admin/conversations GET] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  // Forward query params (e.g., borrowerId) to the backend
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const backendUrl = `${backendBase}/conversations${qs ? `?${qs}` : ""}`;

  // ── Diagnostic: log exact target URL on every request ─────────────────────
  console.log("[proxy/admin/conversations GET] → backend URL:", backendUrl);
  console.log("[proxy/admin/conversations GET] token present:", !!token, "| length:", token.length);

  let backendRes: Response;
  try {
    backendRes = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/conversations GET] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // ── Diagnostic: log every non-2xx backend response in full ────────────────
  if (!backendRes.ok) {
    let rawBody = "<could not read body>";
    try {
      rawBody = await backendRes.text();
    } catch {
      // ignore read error
    }
    console.error(
      `[proxy/admin/conversations GET] Backend responded ${backendRes.status} ${backendRes.statusText}` +
      ` | URL: ${backendUrl}` +
      ` | body: ${rawBody}`
    );
    // Return the backend status + a structured error so the client UI can
    // distinguish auth failures (401) from route issues (404/503).
    return NextResponse.json(
      { message: `Backend error ${backendRes.status}`, detail: rawBody },
      { status: backendRes.status }
    );
  }

  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    return NextResponse.json({ message: "Unexpected response from backend." }, { status: 502 });
  }

  return NextResponse.json(data, { status: backendRes.status });
}

// =============================================================================
// POST /api/admin/conversations
//
// Proxies a conversation find-or-create request to the backend.
//
// Request body (JSON):
//   { borrowerId: string }
//
// Response (passed through from backend):
//   200  { conversation }  — Existing conversation returned
//   201  { conversation }  — New conversation created
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[proxy/admin/conversations POST] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  // ── Parse and forward request body ────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const backendUrl = `${backendBase}/conversations`;
  console.log("[proxy/admin/conversations POST] → backend URL:", backendUrl);

  let backendRes: Response;
  try {
    backendRes = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/conversations POST] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  if (!backendRes.ok) {
    let rawBody = "<could not read body>";
    try {
      rawBody = await backendRes.text();
    } catch {
      // ignore
    }
    console.error(
      `[proxy/admin/conversations POST] Backend responded ${backendRes.status}` +
      ` | body: ${rawBody}`
    );
    return NextResponse.json(
      { message: `Backend error ${backendRes.status}`, detail: rawBody },
      { status: backendRes.status }
    );
  }

  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    return NextResponse.json({ message: "Unexpected response from backend." }, { status: 502 });
  }

  return NextResponse.json(data, { status: backendRes.status });
}
