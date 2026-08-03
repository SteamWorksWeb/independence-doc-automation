/**
 * GET /api/admin/documents/[id]/view
 *
 * Proxy to GET /api/v1/admin/documents/:id/view on the backend.
 * Returns { url: string } — a short-lived presigned S3 URL for the document.
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function buildBackendUrl(path: string): string | null {
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, "");
  if (!backendBase) return null;

  const versionedBase = backendBase.endsWith("/api/v1")
    ? backendBase
    : `${backendBase}/api/v1`;

  return `${versionedBase}${path}`;
}

export async function GET(
  _req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const targetUrl = buildBackendUrl(`/admin/documents/${id}/view`);
  if (!targetUrl) {
    console.error("[proxy/admin/documents/:id/view] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("[proxy/admin/documents/:id/view] Network error:", error);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await backendRes.json().catch(() => null);
  if (data == null) {
    console.error("[proxy/admin/documents/:id/view] Non-JSON response from backend:", {
      status: backendRes.status,
      statusText: backendRes.statusText,
      targetUrl,
    });
    return NextResponse.json(
      { message: "Unexpected response from backend." },
      { status: 502 }
    );
  }

  if (!backendRes.ok) {
    console.error("[proxy/admin/documents/:id/view] Backend error:", {
      status: backendRes.status,
      body: data,
    });
  }

  return NextResponse.json(data, { status: backendRes.status });
}
