/**
 * src/app/api/admin/invites/route.ts
 *
 * Server-side proxy for backend invite endpoints:
 *   GET  /api/v1/admin/invites        — list pending invitations
 *   POST /api/v1/admin/invites        — create new invitation
 *
 * Why a proxy?
 *   PendingInvitesTable is a "use client" component. It cannot read the
 *   HttpOnly `admin_session` cookie directly. This Route Handler runs on the
 *   Next.js server, reads the cookie, and forwards requests to the backend
 *   with a Bearer Authorization header — eliminating CORS issues on localhost
 *   and hiding the session cookie from browser JS.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function buildBackendUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "");
  if (!base) return null;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

async function getAdminToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value ?? null;
}

// ── GET /api/admin/invites ────────────────────────────────────────────────────
// Proxies to: GET /api/v1/admin/invites

export async function GET(): Promise<NextResponse> {
  const adminToken = await getAdminToken();
  if (!adminToken) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const targetUrl = buildBackendUrl("/admin/invites");
  if (!targetUrl) {
    console.error("[proxy/admin/invites GET] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/invites GET] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await backendRes.json().catch(() => null);
  if (data == null) {
    return NextResponse.json({ message: "Unexpected response from backend." }, { status: 502 });
  }
  return NextResponse.json(data, { status: backendRes.status });
}

// ── POST /api/admin/invites ───────────────────────────────────────────────────
// Proxies to: POST /api/v1/admin/invites

export async function POST(req: NextRequest): Promise<NextResponse> {
  const adminToken = await getAdminToken();
  if (!adminToken) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const targetUrl = buildBackendUrl("/admin/invites");
  if (!targetUrl) {
    console.error("[proxy/admin/invites POST] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/invites POST] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await backendRes.json().catch(() => null);
  if (data == null) {
    return NextResponse.json({ message: "Unexpected response from backend." }, { status: 502 });
  }
  return NextResponse.json(data, { status: backendRes.status });
}
