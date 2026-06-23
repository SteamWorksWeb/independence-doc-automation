/**
 * src/app/api/auth/register/route.ts
 *
 * POST /api/auth/register
 *
 * Registers a new client account.
 *
 * Flow:
 * 1. Validate input (fullName, email, password)
 * 2. Check for existing account (returns EMAIL_EXISTS code)
 * 3. Hash password with bcrypt
 * 4. Generate HMAC verification token
 * 5. Persist user + token to database (stubbed — replace with your ORM/DB)
 * 6. Send verification email via Nodemailer
 * 7. Return 201 with success message (never expose sensitive internals)
 *
 * Security:
 * - No API keys or secrets hardcoded — all from environment variables
 * - assertAuthEnv() validates required env vars at request time
 * - Passwords never stored in plain text
 * - Rate limiting should be added at the middleware/edge layer (TODO)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  assertAuthEnv,
  generateVerificationToken,
  hashPassword,
  buildVerificationEmail,
} from "@/lib/auth";
import { sendMail } from "@/lib/mailer";

// ── Input validation ──────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterBody {
  fullName: string;
  email: string;
  password: string;
}

function validateBody(body: unknown): { data: RegisterBody } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const { fullName, email, password } = body as Record<string, unknown>;

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2)
    return { error: "Full name is required." };
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email))
    return { error: "A valid email address is required." };
  if (!password || typeof password !== "string" || password.length < 8)
    return { error: "Password must be at least 8 characters." };

  return {
    data: {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
    },
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Validate environment configuration
  try {
    assertAuthEnv();
  } catch (err) {
    console.error("[register] Environment misconfiguration:", err);
    return NextResponse.json(
      { message: "Server configuration error. Contact support." },
      { status: 503 }
    );
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateBody(body);
  if ("error" in validation) {
    return NextResponse.json({ message: validation.error }, { status: 422 });
  }

  const { fullName, email, password } = validation.data;

  try {
    // ── 1. Check for existing user ─────────────────────────────────────────
    // TODO: Replace this stub with your actual database query.
    // Example with Prisma:
    //   const existing = await prisma.user.findUnique({ where: { email } });
    //   if (existing) { ... }
    const existingUser = await checkUserExists(email);
    if (existingUser) {
      return NextResponse.json(
        { message: "An account with this email already exists.", code: "EMAIL_EXISTS" },
        { status: 409 }
      );
    }

    // ── 2. Hash password ────────────────────────────────────────────────────
    const passwordHash = await hashPassword(password);

    // ── 3. Generate verification token ──────────────────────────────────────
    const { rawToken, tokenHash, expiresAt } = generateVerificationToken();

    // ── 4. Persist user to database ─────────────────────────────────────────
    // TODO: Replace this stub with your actual database insert.
    // Example with Prisma:
    //   const user = await prisma.user.create({
    //     data: {
    //       fullName,
    //       email,
    //       passwordHash,
    //       emailVerified: false,
    //       verificationToken: tokenHash,
    //       verificationTokenExpiresAt: expiresAt,
    //     },
    //   });
    const userId = await createUser({ fullName, email, passwordHash, tokenHash, expiresAt });

    console.log(`[register] Created user ${userId} for ${email}`);

    // ── 5. Build verification URL ───────────────────────────────────────────
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // ── 6. Send verification email ──────────────────────────────────────────
    const { subject, html } = buildVerificationEmail(fullName, verifyUrl);
    await sendMail({ to: email, subject, html });

    console.log(`[register] Verification email sent to ${email}`);

    return NextResponse.json(
      {
        message: "Account created. Please check your email to verify your account.",
        userId,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[register] Unexpected error:", err);
    return NextResponse.json(
      { message: "Registration failed. Please try again later." },
      { status: 500 }
    );
  }
}

// ── Database stubs (replace with your ORM) ───────────────────────────────────
// These are placeholder implementations. Swap for Prisma, Drizzle, Supabase, etc.

async function checkUserExists(email: string): Promise<boolean> {
  // TODO: implement with real DB
  console.warn(`[db-stub] checkUserExists called for ${email} — replace with real DB query`);
  return false;
}

async function createUser(data: {
  fullName: string;
  email: string;
  passwordHash: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<string> {
  // TODO: implement with real DB — return the created user's ID
  console.warn(`[db-stub] createUser called for ${data.email} — replace with real DB insert`);
  return `stub-user-${Date.now()}`;
}
