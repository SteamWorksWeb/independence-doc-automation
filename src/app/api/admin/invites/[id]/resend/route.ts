/**
 * src/app/api/admin/invites/[id]/resend/route.ts
 *
 * Server-side proxy for backend resend endpoint:
 *   POST /api/v1/admin/invites/:id/resend     — regenerate token + resend email
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

// ── POST /api/admin/invites/[id]/resend ──────────────────────────────────────

export async function POST(
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
  const targetUrl = buildBackendUrl(`/admin/invites/${id}/resend`);
  if (!targetUrl) {
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/invites resend] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data ?? {}, { status: backendRes.status });
}
