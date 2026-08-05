/**
 * src/app/api/auth/invite/verify/route.ts
 *
 * GET /api/auth/invite/verify?token=xxx
 *
 * Same-origin proxy to the backend's GET /api/v1/auth/invite/verify.
 * Returns the invitation email so the registration form can pre-fill
 * the locked email field without a CORS issue.
 *
 * Response on success:  { valid: true, email, firstName, lastName }
 * Response on failure:  { valid: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token?.trim()) {
    return NextResponse.json(
      { valid: false, error: "Token is required." },
      { status: 400 }
    );
  }

  const backendUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendUrl) {
    console.error("[invite/verify] Missing NEXT_PUBLIC_AWS_API_URL");
    return NextResponse.json(
      { valid: false, error: "Server configuration error." },
      { status: 503 }
    );
  }

  // Backend auth routes are at /api/auth (not /api/v1)
  const backendRoot = backendUrl.replace(/\/api\/v1\/?$/, "");
  const verifyUrl = `${backendRoot}/api/auth/invite/verify?token=${encodeURIComponent(token.trim())}`;

  try {
    const res = await fetch(verifyUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[invite/verify] Backend unreachable:", err);
    return NextResponse.json(
      { valid: false, error: "Unable to verify invitation. Please try again." },
      { status: 503 }
    );
  }
}
