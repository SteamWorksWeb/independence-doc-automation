/**
 * src/app/api/admin/conversations/route.ts
 *
 * GET /api/admin/conversations?borrowerId=<uuid>
 *
 * Server-side proxy: reads the HttpOnly admin_session cookie and forwards
 * the request to the backend:
 *   GET /api/v1/conversations?borrowerId=<uuid>
 *
 * Response shape (passed through from backend):
 *   { conversations: Conversation[] }
 *
 * This proxy is required because HttpOnly cookies are not accessible to
 * browser JS — all auth is handled here on the server.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value ?? null;
}

function getBackendBase(): string | null {
  return process.env.NEXT_PUBLIC_AWS_API_URL ?? null;
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
  const backendUrl = `${backendBase}/api/v1/conversations${qs ? `?${qs}` : ""}`;

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

  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    return NextResponse.json({ message: "Unexpected response from backend." }, { status: 502 });
  }

  return NextResponse.json(data, { status: backendRes.status });
}
