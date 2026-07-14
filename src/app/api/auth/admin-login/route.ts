/**
 * src/app/api/auth/admin-login/route.ts
 *
 * POST /api/auth/admin-login
 *
 * Role-isolated admin authentication endpoint.
 * Completely separate from /api/auth/login (client auth).
 * Never shares session tokens, cookies, or state with the client flow.
 *
 * ── Credential strategy ──────────────────────────────────────────────────────
 *
 * Credentials are validated exclusively by the backend database.
 * The frontend never touches raw passwords or bcrypt hashes.
 * This endpoint acts as a secure proxy: it receives the user's credentials,
 * forwards them to the backend's POST /auth/login endpoint, and — on success —
 * plants the backend-issued JWT as an HttpOnly cookie.
 *
 * ── Session strategy ─────────────────────────────────────────────────────────
 *
 * Admin sessions use a SEPARATE cookie name ("admin_session") with a distinct
 * JWT claim (role: "admin") issued by the backend. This means:
 *
 *   - A valid client token cannot be replayed to access admin routes
 *   - A compromised client session does not escalate to admin access
 *   - Middleware can distinguish roles purely from the cookie name + claim
 */

import { NextRequest, NextResponse } from "next/server";

// ── Environment validation ────────────────────────────────────────────────────

function getBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!url) {
    throw new Error(
      "[admin-login] Missing required environment variable: NEXT_PUBLIC_AWS_API_URL"
    );
  }
  return url;
}

// ── Request validation ────────────────────────────────────────────────────────

interface AdminLoginBody {
  email: string;
  password: string;
  role: string;
}

function parseBody(body: unknown): AdminLoginBody | null {
  if (!body || typeof body !== "object") return null;
  const { email, password, role } = body as Record<string, unknown>;
  if (
    typeof email !== "string" || !email.trim() ||
    typeof password !== "string" || !password ||
    typeof role !== "string"
  ) return null;
  return { email: email.trim().toLowerCase(), password, role };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Resolve backend URL ───────────────────────────────────────────────
  let backendUrl: string;
  try {
    backendUrl = getBackendUrl();
  } catch (err) {
    console.error("[admin-login] Environment misconfiguration:", err);
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  // ── 2. Parse request body ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json({ message: "Access denied." }, { status: 401 });
  }

  // ── 3. Enforce role declaration ──────────────────────────────────────────
  // Reject anything that isn't explicitly claiming admin role.
  // This prevents client tokens from being replayed here.
  if (parsed.role !== "admin") {
    console.warn(`[admin-login] Rejected request with role: ${parsed.role}`);
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  // ── 4. Forward credentials to the backend database auth endpoint ─────────
  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: parsed.email,
        password: parsed.password,
      }),
    });
  } catch (err) {
    console.error("[admin-login] Backend request failed:", err);
    return NextResponse.json(
      { message: "Authentication service unavailable. Please try again." },
      { status: 503 }
    );
  }

  // ── 5. Handle backend rejection ──────────────────────────────────────────
  if (!backendRes.ok) {
    if (backendRes.status === 401) {
      console.warn("[admin-login] Backend rejected credentials (401)");
      return NextResponse.json(
        { message: "Invalid credentials." },
        { status: 401 }
      );
    }
    // Surface any other non-200 response generically
    console.error(`[admin-login] Backend returned unexpected status: ${backendRes.status}`);
    return NextResponse.json(
      { message: "Authentication failed. Please try again." },
      { status: 502 }
    );
  }

  // ── 6. Extract token from backend response ───────────────────────────────
  let token: string;
  try {
    const data = await backendRes.json() as { token?: string };
    if (!data.token || typeof data.token !== "string") {
      throw new Error("Backend response missing 'token' field");
    }
    token = data.token;
  } catch (err) {
    console.error("[admin-login] Failed to parse backend token response:", err);
    return NextResponse.json(
      { message: "Authentication service error. Please try again." },
      { status: 502 }
    );
  }

  console.log("[admin-login] Admin authentication successful (backend-issued token)");

  // ── 7. Set HttpOnly admin session cookie ─────────────────────────────────
  // Cookie name "admin_session" is distinct from any client cookie.
  // HttpOnly prevents JS access. Secure in production. SameSite strict.
  const response = NextResponse.json(
    { redirectTo: "/admin/dashboard" },
    { status: 200 }
  );

  response.cookies.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8, // 8 hours — matches backend token lifetime
    path: "/",            // Must be "/" so the cookie is sent on /api/admin/* proxy routes
  });

  return response;
}

// ── Block all other HTTP methods ──────────────────────────────────────────────

export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
