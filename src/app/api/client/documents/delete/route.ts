/**
 * src/app/api/client/documents/delete/route.ts
 *
 * DELETE /api/client/documents/delete?id=<documentId>
 *
 * Server-side proxy → DELETE <NEXT_PUBLIC_AWS_API_URL>/client/documents/<id>
 *
 * Permanently deletes the S3 object and removes the database record.
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

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const token = await getBorrowerSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backendBase = getBackendBase();
  if (!backendBase) {
    console.error("[client/documents/delete] NEXT_PUBLIC_AWS_API_URL is not configured");
    return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("id");

  if (!documentId || !documentId.trim()) {
    return NextResponse.json({ message: "Missing document id." }, { status: 400 });
  }

  const backendUrl = `${backendBase}/client/documents/${encodeURIComponent(documentId.trim())}`;

  try {
    const res = await fetch(backendUrl, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    // 204 No Content is a success — return a minimal JSON body so the client
    // doesn't crash trying to parse an empty response.
    if (res.status === 204) {
      return NextResponse.json({ message: "Document deleted." }, { status: 200 });
    }

    const data: unknown = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[client/documents/delete] DELETE error:", err);
    return NextResponse.json(
      { message: "Unable to delete the document. Please try again." },
      { status: 502 }
    );
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
