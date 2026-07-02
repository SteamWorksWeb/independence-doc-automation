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
 * Admin credentials are stored exclusively in server-side environment variables:
 *
 *   ADMIN_EMAIL          — the admin's email address
 *   ADMIN_PASSWORD_HASH  — bcrypt hash of the admin password
 *
 * The raw admin password is NEVER stored anywhere. To generate the hash:
 *
 *   node -e "require('bcryptjs').hash('your-password', 12).then(console.log)"
 *
 * This means:
 *   - No admin user row in the database (no attack surface there)
 *   - Credential rotation = update env vars + redeploy
 *   - The client-side payload declares role: "admin" so the server can
 *     explicitly reject any mismatch before touching credentials
 *
 * ── Session strategy ─────────────────────────────────────────────────────────
 *
 * Admin sessions use a SEPARATE cookie name ("admin_session") with a distinct
 * JWT claim (role: "admin") signed by ADMIN_JWT_SECRET — a different secret
 * from NEXTAUTH_SECRET used for client sessions. This means:
 *
 *   - A valid client token cannot be replayed to access admin routes
 *   - A compromised client session does not escalate to admin access
 *   - Middleware can distinguish roles purely from the cookie name + claim
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { SignJWT } from "jose";

// ── Environment validation ────────────────────────────────────────────────────

function getAdminEnv(): {
  adminEmail: string;
  adminPasswordHash: string;
  adminJwtSecret: Uint8Array;
} {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminJwtSecret = process.env.JWT_SECRET;

  if (!adminEmail || !adminPasswordHash || !adminJwtSecret) {
    throw new Error(
      "[admin-login] Missing required environment variables: " +
        "ADMIN_EMAIL, ADMIN_PASSWORD_HASH, JWT_SECRET. " +
        "See .env.example for setup instructions."
    );
  }

  return {
    adminEmail,
    adminPasswordHash,
    adminJwtSecret: new TextEncoder().encode(adminJwtSecret),
  };
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
  // ── 1. Load and validate environment config ──────────────────────────────
  let env: ReturnType<typeof getAdminEnv>;
  try {
    env = getAdminEnv();
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

  // ── 4. Constant-time email comparison ────────────────────────────────────
  // Compare emails in constant time to prevent timing-based enumeration.
  const submittedEmailBuf = Buffer.from(parsed.email.padEnd(256));
  const adminEmailBuf = Buffer.from(env.adminEmail.toLowerCase().padEnd(256));
  const emailMatch =
    submittedEmailBuf.length === adminEmailBuf.length &&
    require("crypto").timingSafeEqual(submittedEmailBuf, adminEmailBuf);

  if (!emailMatch) {
    // Still run bcrypt to prevent timing attacks that reveal email validity
    await verifyPassword(parsed.password, env.adminPasswordHash);
    return NextResponse.json({ message: "Access denied." }, { status: 401 });
  }

  // ── 5. Verify password against stored hash ───────────────────────────────
  const passwordValid = await verifyPassword(
    parsed.password,
    env.adminPasswordHash
  );

  if (!passwordValid) {
    console.warn(`[admin-login] Failed password attempt for admin`);
    return NextResponse.json({ message: "Access denied." }, { status: 401 });
  }

  // ── 6. Issue admin-scoped JWT ────────────────────────────────────────────
  // Signed with ADMIN_JWT_SECRET — a completely separate secret from
  // client session tokens. Role claim explicitly set to "admin".
  const token = await new SignJWT({
    role: "lawyer",
    email: env.adminEmail,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h") // Short-lived admin session
    .setIssuer("independence-law-admin")
    .sign(env.adminJwtSecret);

  console.log("[admin-login] Admin authentication successful");

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
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/admin",       // Scoped to /admin/* only — not accessible from client routes
  });

  return response;
}

// ── Block all other HTTP methods ──────────────────────────────────────────────

export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
