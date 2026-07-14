/**
 * src/app/api/admin/clients/[id]/messages/route.ts
 *
 * GET  /api/admin/clients/[id]/messages  — Fetch message thread
 * POST /api/admin/clients/[id]/messages  — Send a message as LAWYER
 *
 * Server-side proxies for the backend messaging endpoints:
 *   GET  /api/v1/admin/clients/:id/messages
 *   POST /api/v1/admin/clients/:id/messages
 *
 * Both routes read the admin_session HttpOnly cookie, attach it as a Bearer
 * token, and forward the request to the Render backend. This proxy pattern
 * is required because HttpOnly cookies are not accessible to browser JS.
 *
 * GET  response shape:  { messages: Message[] }
 * POST request body:    { content: string }
 * POST response shape:  { message: Message }
 *
 * Message shape:
 *   { id, content, senderType ("LAWYER"|"CLIENT"), lawyerId, clientId, createdAt }
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
  return process.env.NEXT_PUBLIC_AWS_API_URL ?? null;
}

// =============================================================================
// GET /api/admin/clients/[id]/messages
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
    console.error("[proxy/admin/clients/:id/messages GET] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendBase}/admin/clients/${id}/messages`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/clients/:id/messages GET] Network error:", err);
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
// POST /api/admin/clients/[id]/messages
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
    console.error("[proxy/admin/clients/:id/messages POST] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  // Parse request body from the client component
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendBase}/admin/clients/${id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[proxy/admin/clients/:id/messages POST] Network error:", err);
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
