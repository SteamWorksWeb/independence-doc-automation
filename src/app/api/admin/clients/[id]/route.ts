/**
 * src/app/api/admin/clients/[id]/route.ts
 *
 * GET /api/admin/clients/[id]
 *
 * Server-side proxy for the backend route GET /api/v1/admin/clients/:id.
 *
 * Reads the admin_session HttpOnly cookie (set by /api/auth/admin-login),
 * attaches it as a Bearer token, and forwards the request to the Render
 * backend. Returns the full client + intakeProfile payload to the frontend.
 *
 * This proxy pattern is required because HttpOnly cookies are not accessible
 * to browser JavaScript — only the Next.js server can read them.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // ── 1. Resolve the dynamic segment ──────────────────────────────────────────
  const { id } = await context.params;

  // ── 2. Read the admin session cookie ────────────────────────────────────────
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { message: "Unauthorized: No active admin session." },
      { status: 401 }
    );
  }

  // ── 3. Resolve backend URL ───────────────────────────────────────────────────
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error("[proxy/admin/clients/:id] NEXT_PUBLIC_AWS_API_URL is not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  const targetUrl = `${backendBase}/admin/clients/${id}`;

  // ── 4. Forward request to backend ────────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionCookie.value}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy/admin/clients/:id] Network error reaching backend:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }

  // ── 5. Parse and relay the response ─────────────────────────────────────────
  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    console.error("[proxy/admin/clients/:id] Backend returned non-JSON response.");
    return NextResponse.json(
      { message: "Unexpected response from backend." },
      { status: 502 }
    );
  }

  return NextResponse.json(data, { status: backendRes.status });
}

// ── Block all other HTTP methods ─────────────────────────────────────────────

export function POST(): NextResponse {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
