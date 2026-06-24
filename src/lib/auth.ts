/**
 * src/lib/auth.ts
 *
 * Authentication library for The Independence Law Firm Client Portal.
 *
 * Security principles enforced here:
 * - All secrets loaded from server-side environment variables (never hardcoded)
 * - Passwords hashed with bcrypt (cost factor 12)
 * - Email verification tokens are UUID v4 hashed with HMAC-SHA256
 * - Tokens expire after EMAIL_VERIFY_TOKEN_EXPIRY seconds (default 24h)
 * - No sensitive data returned in public-facing API responses
 *
 * Note: Email template construction has moved to src/lib/email.ts (Resend).
 * This module handles cryptographic primitives only.
 */

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

// ── Environment variable validation ──────────────────────────────────────────
// Called once at module load time to fail fast if configuration is missing.
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[auth] Missing required environment variable: ${key}. ` +
        `Copy .env.example to .env.local and fill in all values.`
    );
  }
  return value;
}

// ── Token generation & verification ──────────────────────────────────────────

/**
 * Generates a cryptographically secure email verification token.
 * Returns both the raw token (sent in the email link) and its HMAC hash
 * (stored in the database for comparison).
 */
export function generateVerificationToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const tokenSecret = requireEnv("TOKEN_SECRET");
  const rawToken = uuidv4();
  const tokenHash = crypto
    .createHmac("sha256", tokenSecret)
    .update(rawToken)
    .digest("hex");

  const expirySeconds = parseInt(
    process.env.EMAIL_VERIFY_TOKEN_EXPIRY ?? "86400",
    10
  );
  const expiresAt = new Date(Date.now() + expirySeconds * 1000);

  return { rawToken, tokenHash, expiresAt };
}

/**
 * Verifies a raw token from an email link against a stored hash.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyTokenHash(rawToken: string, storedHash: string): boolean {
  const tokenSecret = requireEnv("TOKEN_SECRET");
  const expectedHash = crypto
    .createHmac("sha256", tokenSecret)
    .update(rawToken)
    .digest("hex");

  // timingSafeEqual requires equal-length Buffers
  const expected = Buffer.from(expectedHash, "hex");
  const stored = Buffer.from(storedHash, "hex");

  if (expected.length !== stored.length) return false;
  return crypto.timingSafeEqual(expected, stored);
}

// ── Password hashing ─────────────────────────────────────────────────────────

/**
 * Hashes a password using bcrypt with cost factor 12.
 * Import bcryptjs lazily to avoid issues in edge runtimes.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(plaintext, 12);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(plaintext, hash);
}

// ── Auth guard helper (server components / API routes) ───────────────────────

/**
 * Validates that all required auth environment variables are present.
 * Call this at the top of any API route that touches authentication.
 *
 * Note: Registration-specific env validation lives in the register route
 * (assertRegisterEnv) to keep concerns separated.
 */
export function assertAuthEnv(): void {
  requireEnv("NEXTAUTH_SECRET");
  requireEnv("TOKEN_SECRET");
}
