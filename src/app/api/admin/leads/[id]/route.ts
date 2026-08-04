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
    : backendBase.endsWith("/api")
    ? `${backendBase}/v1`
    : `${backendBase}/api/v1`;

  return `${versionedBase}${path}`;
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { id } = await context.params;
  const clientId = req.nextUrl.searchParams.get("clientId")?.trim();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  const targetUrl = buildBackendUrl(`/admin/leads/${id}`);
  if (!targetUrl) {
    console.error("[proxy/admin/leads/:id] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  let backendRes: Response;
  try {
    backendRes = await deleteFromBackend(targetUrl, sessionCookie.value);

    if (backendRes.status === 404) {
      const fallbackUrl = buildBackendUrl(`/admin/clients/${clientId || id}/snapshot`);
      if (fallbackUrl) {
        backendRes = await deleteFromBackend(fallbackUrl, sessionCookie.value);
      }
    }
  } catch (err) {
    console.error("[proxy/admin/leads/:id] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  if (backendRes.ok) {
    return NextResponse.json({ success: true });
  }

  const data = await backendRes.json().catch(() => null);
  const message = readApiMessage(data) ?? `Delete failed (${backendRes.status}).`;
  console.error("[proxy/admin/leads/:id] Delete failed:", {
    status: backendRes.status,
    body: data,
  });
  return NextResponse.json({ message }, { status: backendRes.status });
}

export function GET(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}

export function POST(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}

function deleteFromBackend(targetUrl: string, token: string): Promise<Response> {
  return fetch(targetUrl, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
}

function readApiMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const message = record.message ?? record.error;
  return typeof message === "string" && message.trim() ? message : null;
}
