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

// ── Verification email builder ────────────────────────────────────────────────

/**
 * Returns the verification email subject and HTML body.
 * The actual transport (Nodemailer) lives in src/lib/mailer.ts.
 */
export function buildVerificationEmail(
  recipientName: string,
  verifyUrl: string
): { subject: string; html: string } {
  const subject = "Verify your Independence Law Portal account";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f5f7; font-family: 'Georgia', serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    .header { background: #1a2744; padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 22px; margin: 8px 0 0; font-weight: 700; letter-spacing: 0.03em; }
    .header p { color: #c0c8d8; font-size: 13px; margin: 4px 0 0; }
    .body { padding: 40px; }
    .body p { color: #333; font-size: 15px; line-height: 1.7; }
    .cta { text-align: center; margin: 32px 0; }
    .cta a {
      display: inline-block;
      background: #b31e3c;
      color: #ffffff;
      text-decoration: none;
      padding: 14px 36px;
      border-radius: 3px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .footer { background: #f4f5f7; padding: 20px 40px; text-align: center; }
    .footer p { color: #888; font-size: 12px; margin: 4px 0; }
    .expires { color: #888; font-size: 13px; margin-top: 24px; }
    .url-fallback { word-break: break-all; font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="20" fill="#b31e3c"/>
        <path d="M20 8L22.5 15.5H30.5L24 20L26.5 27.5L20 23L13.5 27.5L16 20L9.5 15.5H17.5L20 8Z" fill="white"/>
      </svg>
      <h1>The Independence Law Firm</h1>
      <p>Secure Client Portal</p>
    </div>
    <div class="body">
      <p>Dear <strong>${recipientName}</strong>,</p>
      <p>
        Thank you for creating your Independence Law Firm client portal account.
        To complete your registration and access your case documents, please verify
        your email address by clicking the button below.
      </p>
      <div class="cta">
        <a href="${verifyUrl}">Verify My Email Address</a>
      </div>
      <p class="expires">⏳ This link expires in <strong>24 hours</strong>.</p>
      <p>If you did not create an account with us, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size:12px; color:#888;">
        If the button above doesn't work, copy and paste this URL into your browser:
      </p>
      <p class="url-fallback">${verifyUrl}</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} The Independence Law Firm. All rights reserved.</p>
      <p>This is an automated message — please do not reply directly.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

// ── Auth guard helper (server components / API routes) ───────────────────────

/**
 * Validates that all required auth environment variables are present.
 * Call this at the top of any API route that touches authentication.
 */
export function assertAuthEnv(): void {
  requireEnv("NEXTAUTH_SECRET");
  requireEnv("TOKEN_SECRET");
  requireEnv("DATABASE_URL");
}
