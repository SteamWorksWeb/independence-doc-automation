/**
 * src/app/api/admin/profile/route.ts
 *
 * GET  /api/admin/profile  → GET  /api/v1/admin/profile
 * PUT  /api/admin/profile  → PUT  /api/v1/admin/profile
 *
 * Server-side proxy so the admin session JWT (HttpOnly cookie) never
 * touches the browser. Reads "admin_session" cookie and forwards it as
 * a Bearer Authorization header to the Render backend.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function buildBackendUrl(path: string): string | null {
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "");
  if (!backendBase) return null;

  const versionedBase = backendBase.endsWith("/api/v1")
    ? backendBase
    : `${backendBase}/api/v1`;

  return `${versionedBase}${path}`;
}

async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value ?? null;
}

// ── GET /api/admin/profile ────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const targetUrl = buildBackendUrl("/admin/profile");
  if (!targetUrl) {
    console.error("[proxy/admin/profile] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/profile] GET network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}

// ── PUT /api/admin/profile ────────────────────────────────────────────────────

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const targetUrl = buildBackendUrl("/admin/profile");
  if (!targetUrl) {
    console.error("[proxy/admin/profile] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON request body." }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/profile] PUT network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}

// ── Block unsupported methods ─────────────────────────────────────────────────

export function POST(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}

export function DELETE(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
