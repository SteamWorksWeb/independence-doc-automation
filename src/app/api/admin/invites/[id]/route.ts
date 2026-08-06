/**
 * src/app/api/admin/invites/[id]/route.ts
 *
 * Server-side proxy for backend per-invite endpoints:
 *   DELETE /api/v1/admin/invites/:id          — revoke an invitation
 *
 * Auth: reads `admin_session` HttpOnly cookie server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function buildBackendUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "");
  if (!base) return null;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function getAdminToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value ?? null;
}

// ── DELETE /api/admin/invites/[id] ───────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const adminToken = await getAdminToken();
  if (!adminToken) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const targetUrl = buildBackendUrl(`/admin/invites/${id}`);
  if (!targetUrl) {
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/invites DELETE] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // 204 No Content — no JSON body
  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data ?? {}, { status: backendRes.status });
}
