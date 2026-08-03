/**
 * src/app/api/client/documents/list/route.ts
 *
 * GET /api/client/documents/list
 *
 * Server-side proxy → GET <NEXT_PUBLIC_AWS_API_URL>/client/documents
 *
 * Returns the list of documents the client has previously uploaded.
 * Supports optional query param: ?category=<slug>
 *
 * Auth: reads HttpOnly borrower_session / client_token cookie.
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getBorrowerSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[client/documents/list] NEXT_PUBLIC_AWS_API_URL is not configured");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  // Forward optional query params (e.g. category filter)
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const backendUrl = `${backendBase}/client/documents${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data: unknown = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[client/documents/list] GET error:", err);
    return NextResponse.json(
      { message: "Unable to load your documents. Please try again." },
      { status: 502 }
    );
  }
}

export function POST(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
