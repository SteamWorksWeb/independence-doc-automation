/**
 * src/app/api/client/documents/presigned-url/route.ts
 *
 * POST /api/client/documents/presigned-url
 *
 * Server-side proxy → POST <NEXT_PUBLIC_AWS_API_URL>/client/documents/presigned-url
 *
 * Request body (JSON):
 *   { fileName: string; fileType: string }
 *
 * Response (passed through from backend):
 *   { url: string; s3Key: string }
 *
 * Auth: reads HttpOnly borrower_session / client_token cookie; browser JS never
 * touches the JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BORROWER_SESSION_COOKIE_NAMES = ["borrower_session", "client_token"] as const;

async function getBorrowerSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  for (const name of BORROWER_SESSION_COOKIE_NAMES) {
    const token = cookieStore.get(name)?.value;
    if (token) return token;
  }
  return undefined;
}

function getBackendBase(): string | null {
  return process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "") ?? null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getBorrowerSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[client/documents/presigned-url] NEXT_PUBLIC_AWS_API_URL is not configured");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const backendUrl = `${backendBase}/client/documents/presigned-url`;

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data: unknown = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[client/documents/presigned-url] POST error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
