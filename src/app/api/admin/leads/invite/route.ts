/**
 * src/app/api/admin/leads/invite/route.ts
 *
 * POST /api/admin/leads/invite
 *
 * Server-side proxy for the backend route:
 *   POST /api/v1/admin/leads/invite
 *
 * Why a proxy?
 *   The lawyer's JWT lives in an HttpOnly cookie ("admin_session") that is
 *   invisible to browser JavaScript. This Route Handler runs on the Next.js
 *   server, reads the cookie via next/headers, and forwards the request to
 *   the Render backend with a Bearer Authorization header.
 *
 *   InviteBorrowerModal POSTs to THIS route; it never calls the backend
 *   directly. This also eliminates CORS issues when the backend is hosted on
 *   a different origin (e.g. Render).
 *
 * Response normalisation:
 *   The backend returns { invitation: { id, email, token, expiresAt }, intakeLink }.
 *   This proxy flattens the shape to { token, inviteLink, email, message } so
 *   InviteBorrowerModal can consume it without knowing the backend structure.
 *
 * Cookie name : "admin_session"
 *   Set by    : POST /api/auth/admin-login
 *   Scope     : path=/admin, HttpOnly, SameSite=strict
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function buildBackendUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "");
  if (!base) return null;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const versionedBase = base.endsWith("/api/v1")
    ? base
    : base.endsWith("/api")
    ? `${base}/v1`
    : `${base}/api/v1`;
  return `${versionedBase}${normalizedPath}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Read the admin session cookie ────────────────────────────────────────
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  // ── 2. Resolve backend URL ───────────────────────────────────────────────────
  const targetUrl = buildBackendUrl("/admin/leads/invite");
  if (!targetUrl) {
    console.error(
      "[proxy/admin/leads/invite] NEXT_PUBLIC_AWS_API_URL is not set."
    );
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  // ── 3. Parse the incoming body ───────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // ── 4. Forward POST to backend ───────────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Attach the JWT as a Bearer token — backend reads Authorization header
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      "[proxy/admin/leads/invite] Network error reaching backend:",
      err
    );
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // ── 5. Parse the backend response ───────────────────────────────────────────
  let data: Record<string, unknown>;
  try {
    data = (await backendRes.json()) as Record<string, unknown>;
  } catch {
    console.error(
      "[proxy/admin/leads/invite] Backend returned non-JSON response."
    );
    return NextResponse.json(
      { message: "Unexpected response from backend." },
      { status: 502 }
    );
  }

  // ── 6. Normalise response shape for the modal ────────────────────────────────
  // Backend: { invitation: { id, email, token, expiresAt, createdAt }, intakeLink }
  // Modal expects: { token, inviteLink, email, message }
  if (backendRes.ok) {
    const invitation = data.invitation as Record<string, unknown> | undefined;
    return NextResponse.json(
      {
        token:      invitation?.token   ?? null,
        inviteLink: data.intakeLink     ?? null,
        email:      invitation?.email   ?? null,
        message:    data.message        ?? "Invitation sent successfully.",
      },
      { status: backendRes.status }
    );
  }

  // Relay error responses unchanged so the modal can surface the backend message
  return NextResponse.json(data, { status: backendRes.status });
}
