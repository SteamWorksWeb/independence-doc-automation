/**
 * src/app/api/admin/clients/route.ts
 *
 * GET /api/admin/clients
 *
 * Server-side proxy for the backend route GET /api/v1/admin/clients.
 *
 * Why a proxy?
 *   The lawyer's session token lives in an HttpOnly cookie ("admin_session")
 *   that is invisible to browser JavaScript. This Next.js Route Handler runs
 *   on the server, can read the cookie via next/headers, and attaches it as a
 *   Bearer token in the Authorization header before forwarding the request to
 *   the Render backend.
 *
 *   The frontend never sees the raw JWT — it only talks to this proxy, which
 *   acts as a trusted intermediary within the same origin.
 *
 * Cookie name: "admin_session"
 *   Set by /api/auth/admin-login, path=/admin, HttpOnly, SameSite=strict.
 *   Scope matches: this route lives under /admin/* in the API tree.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  // ── 1. Read the admin session cookie ──────────────────────────────────────
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  // ── 2. Resolve backend URL ─────────────────────────────────────────────────
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error("[proxy/admin/clients] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  const targetUrl = `${backendBase}/admin/clients`;

  // ── 3. Forward request to backend ─────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Attach the JWT as a Bearer token — the backend reads Authorization header
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      // Always re-validate; never serve a cached admin list
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/clients] Network error reaching backend:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // ── 4. Parse and relay the response ───────────────────────────────────────
  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    console.error("[proxy/admin/clients] Backend returned non-JSON response.");
    return NextResponse.json(
      { message: "Unexpected response from backend." },
      { status: 502 }
    );
  }

  return NextResponse.json(data, { status: backendRes.status });
}

// ── Block all other HTTP methods ──────────────────────────────────────────────

export function POST() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
