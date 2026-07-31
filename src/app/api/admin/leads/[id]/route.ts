import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
  _req: Request,
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
    backendRes = await fetch(targetUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/leads/:id] Network error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}

export function GET(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}

export function POST(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
