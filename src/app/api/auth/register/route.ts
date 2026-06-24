/**
 * src/app/api/auth/register/route.ts
 *
 * POST /api/auth/register
 *
 * Registers a new client account against the AWS Node.js backend,
 * then triggers the Resend verification email loop.
 *
 * ── Execution flow ───────────────────────────────────────────────────────────
 *
 *  1. Strict input validation (fullName, email, password)
 *  2. Hash the password with bcrypt (cost 12) — plain-text never leaves this fn
 *  3. POST client record to AWS backend via api-client.ts
 *     — Backend returns { clientId } on success
 *     — ApiError with code "EMAIL_EXISTS" → 409
 *     — Any 5xx from backend → 502 (never expose backend stack)
 *  4. Generate HMAC-SHA256 verification token (UUID v4 + TOKEN_SECRET)
 *  5. PATCH the token + expiry onto the new client record in the backend
 *  6. Trigger sendVerificationEmail() from Resend
 *  7. Return 201 — never echo passwords, tokens, or hashes to the client
 *
 * ── Security mandate ─────────────────────────────────────────────────────────
 *
 *  - Plain-text passwords are NEVER logged or passed beyond hashPassword()
 *  - Backend error details are logged server-side only (never in response body)
 *  - Token hash is stored on the backend; raw token only travels in the email
 *  - All secrets loaded from server env vars (assertRegisterEnv enforces this)
 *  - Rate limiting should be applied at the proxy layer (TODO: v1.5)
 */

import { NextRequest, NextResponse } from "next/server";
import { generateVerificationToken, hashPassword } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { apiPost, apiPatch, ApiError } from "@/lib/api-client";

// ── Environment guard ─────────────────────────────────────────────────────────

function assertRegisterEnv(): void {
  const missing: string[] = [];
  if (!process.env.TOKEN_SECRET)              missing.push("TOKEN_SECRET");
  if (!process.env.RESEND_API_KEY)            missing.push("RESEND_API_KEY");
  if (!process.env.NEXT_PUBLIC_AWS_API_URL)   missing.push("NEXT_PUBLIC_AWS_API_URL");
  if (!process.env.AWS_API_SECRET)            missing.push("AWS_API_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `[register] Missing required environment variables: ${missing.join(", ")}. ` +
      "See .env.example for configuration instructions."
    );
  }
}

// ── Input validation ──────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_MIN_LENGTH = 8;

interface RegisterBody {
  fullName: string;
  email: string;
  password: string;
}

function validateBody(body: unknown):
  | { data: RegisterBody }
  | { field: string; message: string }
{
  if (!body || typeof body !== "object") {
    return { field: "body", message: "Invalid request body." };
  }

  const { fullName, email, password } = body as Record<string, unknown>;

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    return { field: "fullName", message: "Full name must be at least 2 characters." };
  }
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    return { field: "email", message: "A valid email address is required." };
  }
  if (!password || typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return { field: "password", message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }

  return {
    data: {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password, // raw — only passed to hashPassword(), never logged
    },
  };
}

// ── Backend types ─────────────────────────────────────────────────────────────

interface CreateClientResponse {
  clientId: string;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {

  // ── 0. Environment guard ──────────────────────────────────────────────────
  try {
    assertRegisterEnv();
  } catch (err) {
    console.error("[register] Environment misconfiguration:", (err as Error).message);
    return NextResponse.json(
      { message: "Server configuration error. Contact support." },
      { status: 503 }
    );
  }

  // ── 1. Parse request body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  // ── 2. Validate input fields ──────────────────────────────────────────────
  const validation = validateBody(body);
  if ("field" in validation) {
    return NextResponse.json(
      { message: validation.message, field: validation.field },
      { status: 422 }
    );
  }

  const { fullName, email, password } = validation.data;

  // ── 3. Hash password — raw value goes no further ──────────────────────────
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch (err) {
    console.error("[register] bcrypt failure:", err);
    return NextResponse.json(
      { message: "Registration failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 4. Create client record on AWS backend ────────────────────────────────
  let clientId: string;
  try {
    const created = await apiPost<CreateClientResponse>("/clients", {
      fullName,
      email,
      passwordHash, // hashed — never the plaintext password
      status: "pending",
      emailVerified: false,
    });

    clientId = created.clientId;
    console.log(`[register] Client record created: ${clientId} for ${email}`);

  } catch (err) {
    if (err instanceof ApiError) {
      // Email already registered — surface cleanly to frontend
      if (err.status === 409 || err.code === "EMAIL_EXISTS") {
        return NextResponse.json(
          { message: "An account with this email already exists.", code: "EMAIL_EXISTS" },
          { status: 409 }
        );
      }

      // Backend validation rejection
      if (err.status === 422) {
        return NextResponse.json(
          { message: "Invalid registration data. Please check your details." },
          { status: 422 }
        );
      }

      // Backend unreachable or 5xx — log internally, return opaque 502
      console.error(
        `[register] AWS backend error ${err.status} creating client:`,
        err.message // backend detail stays server-side
      );
      return NextResponse.json(
        { message: "Registration service unavailable. Please try again later." },
        { status: 502 }
      );
    }

    // Network timeout or unexpected error
    console.error("[register] Unexpected error creating client:", err);
    return NextResponse.json(
      { message: "Registration failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 5. Generate cryptographic verification token ──────────────────────────
  const { rawToken, tokenHash, expiresAt } = generateVerificationToken();

  // ── 6. Persist token to backend (PATCH onto the new client record) ────────
  try {
    await apiPatch(`/clients/${clientId}`, {
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    // Non-fatal: log and continue — email won't verify but registration succeeded.
    // The resend-verification endpoint can recover this case.
    console.error(
      `[register] Failed to persist verification token for client ${clientId}:`,
      err instanceof ApiError ? err.message : err
    );
  }

  // ── 7. Build verification URL ─────────────────────────────────────────────
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verificationUrl =
    `${baseUrl}/api/auth/verify-email` +
    `?token=${encodeURIComponent(rawToken)}` +
    `&email=${encodeURIComponent(email)}`;

  // ── 8. Send verification email via Resend ─────────────────────────────────
  const emailResult = await sendVerificationEmail({
    to: email,
    name: fullName,
    verificationUrl,
  });

  if (!emailResult.success) {
    // Log the failure — but don't block registration. The client record exists.
    // The user can trigger a resend from the "pending verification" UI state.
    console.error(
      `[register] Resend failed for ${email}: ${emailResult.error}`
    );
  } else {
    console.log(
      `[register] Verification email sent to ${email} (msg: ${emailResult.messageId})`
    );
  }

  // ── 9. Return 201 — never expose clientId, hash, token, or email errors ──
  return NextResponse.json(
    {
      message: "Account created. Please check your email to verify your account.",
      // Surface email delivery status so the frontend can show the right UI:
      emailSent: emailResult.success,
    },
    { status: 201 }
  );
}

// ── Block all other HTTP methods ──────────────────────────────────────────────

export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
