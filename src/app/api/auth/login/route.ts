/**
 * src/app/api/auth/login/route.ts
 *
 * POST /api/auth/login
 *
 * Authenticates a client by proxying credentials to the Render backend,
 * then sets an HttpOnly JWT cookie for the /dashboard/* guard in proxy.ts.
 *
 * Flow:
 *   1. Validate input fields
 *   2. POST email + password to Render backend POST /auth/login
 *   3. Backend verifies credentials and returns { token, lawyer/client }
 *   4. We store the JWT in an HttpOnly cookie named "client_token"
 *   5. Return { redirectTo: "/dashboard" }
 *
 * Cookie "client_token" is read by proxy.ts to guard /dashboard/*.
 * It is scoped to "/" so the proxy can read it on any page.
 */

import { NextRequest, NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateBody(body: unknown): { email: string; password: string } | null {
  if (!body || typeof body !== "object") return null;
  const { email, password } = body as Record<string, unknown>;
  if (
    !email || typeof email !== "string" || !EMAIL_REGEX.test(email) ||
    !password || typeof password !== "string"
  ) return null;
  return { email: email.trim().toLowerCase(), password };
}

export async function POST(request: NextRequest) {
  // ── 1. Validate env ──────────────────────────────────────────────────────
  const backendUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
  const apiSecret  = process.env.AWS_API_SECRET;

  if (!backendUrl || !apiSecret) {
    console.error("[login] Missing NEXT_PUBLIC_AWS_API_URL or AWS_API_SECRET");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const validated = validateBody(body);
  if (!validated) {
    return NextResponse.json(
      { message: "Email and password are required." },
      { status: 422 }
    );
  }

  // ── 3. Call Render backend ───────────────────────────────────────────────
  // The backend exposes POST /auth/login (mounted at /api/auth in server.ts).
  // NEXT_PUBLIC_AWS_API_URL is set to https://<render-host>/api/v1 in env —
  // but the auth route is at /api/auth (not /api/v1), so we build from the
  // root by stripping the /api/v1 suffix.
  const backendRoot = backendUrl.replace(/\/api\/v1\/?$/, "");
  const loginEndpoint = `${backendRoot}/api/auth/login`;

  let backendRes: Response;
  try {
    backendRes = await fetch(loginEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiSecret}`,
      },
      body: JSON.stringify({
        email: validated.email,
        password: validated.password,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error("[login] Backend unreachable:", err);
    return NextResponse.json(
      { message: "Unable to reach authentication server. Please try again." },
      { status: 503 }
    );
  }

  // ── 4. Handle backend response ───────────────────────────────────────────
  let data: Record<string, unknown>;
  try {
    data = await backendRes.json();
  } catch {
    console.error("[login] Non-JSON response from backend:", backendRes.status);
    return NextResponse.json(
      { message: "Login failed. Please try again." },
      { status: 500 }
    );
  }

  if (!backendRes.ok) {
    // Relay the backend's error message to the client
    const message =
      typeof data.error === "string" ? data.error :
      typeof data.message === "string" ? data.message :
      "Invalid email or password.";

    return NextResponse.json({ message }, { status: backendRes.status });
  }

  // ── 5. Extract JWT from backend response ─────────────────────────────────
  const token = typeof data.token === "string" ? data.token : null;

  if (!token) {
    console.error("[login] Backend returned 200 but no token field:", data);
    return NextResponse.json(
      { message: "Login failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 6. Set HttpOnly cookie "client_token" ────────────────────────────────
  // This cookie name is read by proxy.ts handleClientRoute() to grant
  // access to /dashboard/*. Must be HttpOnly (no JS access).
  const response = NextResponse.json(
    { redirectTo: "/dashboard" },
    { status: 200 }
  );

  response.cookies.set("client_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days — matches JWT_EXPIRES_IN on backend
    path: "/",
  });

  console.log("[login] Client authenticated successfully");
  return response;
}

// ── Block all other HTTP methods ──────────────────────────────────────────────

export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
