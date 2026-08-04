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

  const targetUrl = buildBackendUrl(`/admin/clients/${id}/profile`);
  if (!targetUrl) {
    console.error("[proxy/admin/clients/:id/profile] NEXT_PUBLIC_AWS_API_URL is not set.");
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
    console.error("Profile Fetch Error:", error);
    console.error("[proxy/admin/clients/:id/profile] Network error:", error);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await backendRes.json().catch(() => null);
  if (data == null) {
    console.error("Profile Fetch Error:", {
      status: backendRes.status,
      statusText: backendRes.statusText,
      targetUrl,
      body: null,
    });
    return NextResponse.json(
      { message: "Unexpected response from backend." },
      { status: 502 }
    );
  }

  if (!backendRes.ok) {
    console.error("Profile Fetch Error:", {
      status: backendRes.status,
      statusText: backendRes.statusText,
      targetUrl,
      body: data,
    });
  }

  return NextResponse.json(data, { status: backendRes.status });
}

export function POST(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  return forwardProfileMutation(req, context, "PATCH");
}

export async function PUT(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  return forwardProfileMutation(req, context, "PUT");
}

async function forwardProfileMutation(
  req: NextRequest,
  context: RouteContext,
  method: "PATCH" | "PUT"
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

  const targetUrl = buildBackendUrl(`/admin/clients/${id}/snapshot`);
  if (!targetUrl) {
    console.error("[proxy/admin/clients/:id/snapshot] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  const body = await req.text();

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": req.headers.get("content-type") ?? "application/json",
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      body,
      cache: "no-store",
    });
  } catch (error) {
    console.error(`[proxy/admin/clients/:id/snapshot] ${method} network error:`, error);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await backendRes.json().catch(() => null);
  if (data == null) {
    return NextResponse.json(
      { message: "Unexpected response from backend." },
      { status: 502 }
    );
  }

  return NextResponse.json(data, { status: backendRes.status });
}
