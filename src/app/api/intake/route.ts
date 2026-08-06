/**
 * src/app/api/intake/route.ts
 *
 * Server-side proxy for the client intake profile endpoints:
 *   GET  /api/v1/intake  — retrieve the authenticated client's intake profile
 *   POST /api/v1/intake  — create/update intake profile (Step 1 of onboarding)
 *
 * Why a proxy?
 *   The onboarding wizard is a "use client" component. It cannot read the
 *   HttpOnly `client_token` cookie directly. This Route Handler runs on the
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

async function getClientToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return (
    cookieStore.get("client_token")?.value ??
    cookieStore.get("borrower_session")?.value ??
    null
  );
}

// -- GET /api/intake ----------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  const clientToken = await getClientToken();
  if (!clientToken) {
    return NextResponse.json({ message: "Unauthorized: No active client session." }, { status: 401 });
  }

  const targetUrl = buildBackendUrl("/intake");
  if (!targetUrl) {
    console.error("[proxy/intake GET] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${clientToken}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/intake GET] Network error:", err);
    return NextResponse.json({ message: "Unable to reach the backend. Please try again." }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);
  if (data == null) {
    return NextResponse.json({ message: "Unexpected response from backend." }, { status: 502 });
  }
  return NextResponse.json(data, { status: backendRes.status });
}

// -- POST /api/intake ---------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientToken = await getClientToken();
  if (!clientToken) {
    return NextResponse.json({ message: "Unauthorized: No active client session." }, { status: 401 });
  }

  const targetUrl = buildBackendUrl("/intake");
  if (!targetUrl) {
    console.error("[proxy/intake POST] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${clientToken}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/intake POST] Network error:", err);
    return NextResponse.json({ message: "Unable to reach the backend. Please try again." }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);
  if (data == null) {
    return NextResponse.json({ message: "Unexpected response from backend." }, { status: 502 });
  }
  return NextResponse.json(data, { status: backendRes.status });
}