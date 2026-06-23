/**
 * src/app/api/auth/login/route.ts
 *
 * POST /api/auth/login
 *
 * Authenticates an existing client.
 *
 * Flow:
 * 1. Validate input (email, password)
 * 2. Look up user by email
 * 3. Check email is verified — block with EMAIL_NOT_VERIFIED if not
 * 4. Compare bcrypt hash
 * 5. Issue session (NextAuth / JWT — stubbed here)
 * 6. Return redirect path
 *
 * Security:
 * - Uses constant-time bcrypt comparison (no timing attack)
 * - Returns the same generic error for "user not found" and "wrong password"
 *   to prevent user enumeration
 * - EMAIL_NOT_VERIFIED is intentionally surfaced so the user can resend
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAuthEnv, verifyPassword } from "@/lib/auth";

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
  try {
    assertAuthEnv();
  } catch (err) {
    console.error("[login] Environment misconfiguration:", err);
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const validated = validateBody(body);
  if (!validated) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 422 });
  }

  const { email, password } = validated;

  try {
    // ── 1. Look up user ──────────────────────────────────────────────────────
    // TODO: Replace with real database query.
    // Example: const user = await prisma.user.findUnique({ where: { email } });
    const user = await findUserByEmail(email);

    // Generic error — do NOT distinguish "user not found" from "wrong password"
    // to prevent user enumeration attacks
    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    // ── 2. Check email verification ──────────────────────────────────────────
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          message: "Please verify your email before logging in.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    // ── 3. Verify password ───────────────────────────────────────────────────
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    // ── 4. Issue session ─────────────────────────────────────────────────────
    // TODO: Implement proper session management here.
    // Options:
    //   a) NextAuth: call signIn() from a server action
    //   b) JWT: create a signed token with jose and set as HttpOnly cookie
    //   c) Database sessions: create a session record and set session cookie
    //
    // Example with jose (JWT):
    //   const token = await new SignJWT({ sub: user.id, email: user.email })
    //     .setProtectedHeader({ alg: 'HS256' })
    //     .setExpirationTime('7d')
    //     .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET));
    //
    //   const response = NextResponse.json({ redirectTo: '/dashboard' });
    //   response.cookies.set('session', token, {
    //     httpOnly: true,
    //     secure: process.env.NODE_ENV === 'production',
    //     sameSite: 'lax',
    //     maxAge: 60 * 60 * 24 * 7,
    //     path: '/',
    //   });
    //   return response;

    console.log(`[login] Successful login for user ${user.id}`);

    return NextResponse.json(
      { redirectTo: "/dashboard", userId: user.id },
      { status: 200 }
    );
  } catch (err) {
    console.error("[login] Unexpected error:", err);
    return NextResponse.json(
      { message: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}

// ── Database stub ─────────────────────────────────────────────────────────────

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
}

async function findUserByEmail(email: string): Promise<UserRecord | null> {
  // TODO: replace with real DB query
  console.warn(`[db-stub] findUserByEmail called for ${email} — replace with real DB query`);
  return null;
}
