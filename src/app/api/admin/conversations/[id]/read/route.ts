/**
 * src/app/api/admin/conversations/[id]/read/route.ts
 *
 * POST /api/admin/conversations/[id]/read
 *
 * Server-side proxy: reads the HttpOnly admin_session cookie and forwards
 * the request to the backend:
 *   POST /api/v1/conversations/:id/read
 *
 * Marks all messages in the conversation as read by the requesting staff
 * member and clears the unreadCount for that conversation. Called silently
 * in the background when a staff member opens a conversation in the inbox.
 *
 * No request body is required.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value ?? null;
}

function getBackendBase(): string | null {
  return process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "") ?? null;
}

// =============================================================================
// POST /api/admin/conversations/[id]/read
// =============================================================================

export async function POST(
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
    console.error("[proxy/admin/conversations/:id/read POST] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendBase}/conversations/${id}/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.error("[proxy/admin/conversations/:id/read POST] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // 204 No Content is a valid success — don't try to parse it
  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    return NextResponse.json({ message: "Unexpected response from backend." }, { status: 502 });
  }

  return NextResponse.json(data, { status: backendRes.status });
}
