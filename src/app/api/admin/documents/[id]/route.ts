/**
 * DELETE /api/admin/documents/[id]
 *
 * Proxy to DELETE /api/v1/admin/documents/:id on the backend.
 * Removes the document from S3 and the database.
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

export async function DELETE(
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

  const targetUrl = buildBackendUrl(`/admin/documents/${id}`);
  if (!targetUrl) {
    console.error("[proxy/admin/documents/:id] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("[proxy/admin/documents/:id] Network error:", error);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // 204 No Content — success with no body
  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await backendRes.json().catch(() => null);
  if (data == null) {
    console.error("[proxy/admin/documents/:id] Non-JSON response from backend:", {
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
    console.error("[proxy/admin/documents/:id] Backend error:", {
      status: backendRes.status,
      body: data,
    });
  }

  return NextResponse.json(data, { status: backendRes.status });
}
