/**
 * src/app/api/admin/leads/route.ts
 *
 * POST /api/admin/leads
 *
 * Server-side proxy for the backend route:
 *   POST /api/v1/admin/leads
 *
 * Why a proxy?
 *   The lawyer's JWT lives in an HttpOnly cookie ("admin_session") that is
 *   invisible to browser JavaScript. This Route Handler runs on the Next.js
 *   server, reads the cookie via next/headers, and forwards the request to
 *   the Render backend with a Bearer Authorization header.
 *
 *   The wizard client component POSTs to THIS route; it never touches the
 *   backend directly.
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
  const targetUrl = buildBackendUrl("/admin/leads");
  if (!targetUrl) {
    console.error(
      "[proxy/admin/leads] NEXT_PUBLIC_AWS_API_URL is not set."
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
      "[proxy/admin/leads] Network error reaching backend:",
      err
    );
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // ── 5. Parse and relay the response ─────────────────────────────────────────
  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    console.error(
      "[proxy/admin/leads] Backend returned non-JSON response."
    );
    return NextResponse.json(
      { message: "Unexpected response from backend." },
      { status: 502 }
    );
  }

  return NextResponse.json(data, { status: backendRes.status });
}

// ── GET /api/admin/leads?search=... ─────────────────────────────
//
// Server-side proxy for the backend:
//   GET /api/v1/admin/leads[?search=...]
//
// Used by the Compose modal lead-picker to load all lead
// client records.  An optional ?search= query param is forwarded verbatim.

export async function GET(req: NextRequest): Promise<NextResponse> {
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
  const targetBaseUrl = buildBackendUrl("/admin/leads");
  if (!targetBaseUrl) {
    console.error(
      "[proxy/admin/leads GET] NEXT_PUBLIC_AWS_API_URL is not set."
    );
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  // Forward any query params (e.g. ?search=...) from the incoming request
  const incomingSearch = req.nextUrl.searchParams.toString();
  const targetUrl = incomingSearch
    ? `${targetBaseUrl}?${incomingSearch}`
    : targetBaseUrl;

  // ── 3. Forward GET to backend ────────────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      "[proxy/admin/leads GET] Network error reaching backend:",
      err
    );
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // ── 4. Parse and relay the response ─────────────────────────────────────────
  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    console.error(
      "[proxy/admin/leads GET] Backend returned non-JSON response."
    );
    return NextResponse.json(
      { message: "Unexpected response from backend." },
      { status: 502 }
    );
  }

  return NextResponse.json(data, { status: backendRes.status });
}
