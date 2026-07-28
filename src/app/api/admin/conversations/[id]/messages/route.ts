/**
 * src/app/api/admin/conversations/[id]/messages/route.ts
 *
 * GET  /api/admin/conversations/[id]/messages  — Fetch full message history
 * POST /api/admin/conversations/[id]/messages  — Send a message (CLIENT_VISIBLE or INTERNAL)
 *
 * Server-side proxies to:
 *   GET  /api/v1/conversations/:id/messages
 *   POST /api/v1/conversations/:id/messages
 *
 * POST request body:
 *   { body: string; visibility: "CLIENT_VISIBLE" | "INTERNAL" }
 *
 * Both routes read the admin_session HttpOnly cookie and forward it as a
 * Bearer token. HttpOnly cookies are not accessible to browser JS — auth is
 * handled exclusively here on the server.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value ?? null;
}

function getBackendBase(): string | null {
  return process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "") ?? null;
}

// =============================================================================
// GET /api/admin/conversations/[id]/messages
// =============================================================================

export async function GET(
  _req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { id } = await context.params;

  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[proxy/admin/conversations/:id/messages GET] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendBase}/conversations/${id}/messages`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/conversations/:id/messages GET] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
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
// POST /api/admin/conversations/[id]/messages
// =============================================================================

export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { id } = await context.params;

  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[proxy/admin/conversations/:id/messages POST] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendBase}/conversations/${id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[proxy/admin/conversations/:id/messages POST] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
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
