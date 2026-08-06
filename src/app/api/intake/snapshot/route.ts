/**
 * src/app/api/intake/snapshot/route.ts
 *
 * Server-side proxy for the final intake snapshot submission:
 *   POST /api/v1/intake/snapshot  — creates a DischargeSnapshot from the wizard
 *
 * Reads the HttpOnly client_token cookie and forwards the request to the
 * Render backend with a Bearer Authorization header.
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

// -- POST /api/intake/snapshot ------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientToken = await getClientToken();
  if (!clientToken) {
    return NextResponse.json({ message: "Unauthorized: No active client session." }, { status: 401 });
  }

  const targetUrl = buildBackendUrl("/intake/snapshot");
  if (!targetUrl) {
    console.error("[proxy/intake/snapshot POST] NEXT_PUBLIC_AWS_API_URL is not set.");
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
    console.error("[proxy/intake/snapshot POST] Network error:", err);
    return NextResponse.json({ message: "Unable to reach the backend. Please try again." }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);
  if (data == null) {
    return NextResponse.json({ message: "Unexpected response from backend." }, { status: 502 });
  }
  return NextResponse.json(data, { status: backendRes.status });
}