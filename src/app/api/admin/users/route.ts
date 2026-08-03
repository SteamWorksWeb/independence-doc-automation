/**
 * src/app/api/admin/users/route.ts
 *
 * GET /api/admin/users
 *
 * Server-side proxy for GET /api/v1/admin/users.
 * Returns the list of admin user accounts so the frontend can populate
 * assignment dropdowns and similar UI without exposing the raw JWT.
 *
 * Cookie: "admin_session" (HttpOnly, set by /api/auth/admin-login)
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function buildBackendUrl(path: string): string | null {
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "");
  if (!backendBase) return null;

  const versionedBase = backendBase.endsWith("/api/v1")
    ? backendBase
    : `${backendBase}/api/v1`;

  return `${versionedBase}${path}`;
}

export async function GET(): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  // ── 2. Resolve backend URL ──────────────────────────────────────────────────
  const targetUrl = buildBackendUrl("/admin/users");
  if (!targetUrl) {
    console.error("[proxy/admin/users] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  // ── 3. Forward to backend ───────────────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/users] Network error reaching backend:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // ── 4. Relay response ───────────────────────────────────────────────────────
  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}

export function POST(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
