/**
 * src/app/api/auth/verify-email/route.ts
 *
 * GET /api/auth/verify-email?token=<rawToken>&email=<email>
 *
 * Verifies an email address using the token from the verification email.
 *
 * Flow:
 * 1. Parse token + email from query params
 * 2. Look up user by email
 * 3. Verify token hasn't expired
 * 4. Compare token hash using constant-time comparison
 * 5. Mark user as verified + clear token
 * 6. Redirect to login with success param
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyTokenHash } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const failUrl = `${baseUrl}/?verified=fail`;
  const successUrl = `${baseUrl}/?verified=success`;

  if (!token || !email) {
    return NextResponse.redirect(failUrl);
  }

  try {
    // ── 1. Find user by email ────────────────────────────────────────────────
    // TODO: Replace stub with real DB query
    // const user = await prisma.user.findUnique({ where: { email } });
    const user = await findUserWithToken(email.toLowerCase());

    if (!user || user.emailVerified) {
      // Already verified or doesn't exist — redirect to login
      return NextResponse.redirect(successUrl);
    }

    // ── 2. Check token expiry ────────────────────────────────────────────────
    if (user.verificationTokenExpiresAt < new Date()) {
      console.warn(`[verify-email] Expired token for ${email}`);
      return NextResponse.redirect(
        `${baseUrl}/?verified=expired`
      );
    }

    // ── 3. Verify token hash ─────────────────────────────────────────────────
    if (!user.verificationTokenHash || !verifyTokenHash(token, user.verificationTokenHash)) {
      console.warn(`[verify-email] Invalid token for ${email}`);
      return NextResponse.redirect(failUrl);
    }

    // ── 4. Mark as verified ──────────────────────────────────────────────────
    // TODO: Replace stub with real DB update
    // await prisma.user.update({
    //   where: { id: user.id },
    //   data: {
    //     emailVerified: true,
    //     verificationToken: null,
    //     verificationTokenExpiresAt: null,
    //   },
    // });
    await markUserVerified(user.id);

    console.log(`[verify-email] Successfully verified ${email}`);
    return NextResponse.redirect(successUrl);
  } catch (err) {
    console.error("[verify-email] Unexpected error:", err);
    return NextResponse.redirect(failUrl);
  }
}

// ── Database stubs ────────────────────────────────────────────────────────────

interface UserWithToken {
  id: string;
  email: string;
  emailVerified: boolean;
  verificationTokenHash: string | null;
  verificationTokenExpiresAt: Date;
}

async function findUserWithToken(email: string): Promise<UserWithToken | null> {
  // TODO: replace with real DB query
  console.warn(`[db-stub] findUserWithToken called for ${email}`);
  return null;
}

async function markUserVerified(userId: string): Promise<void> {
  // TODO: replace with real DB update
  console.warn(`[db-stub] markUserVerified called for user ${userId}`);
}
