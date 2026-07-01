/**
 * src/actions/registerClient.ts
 *
 * Next.js Server Action — Client Registration
 *
 * Security contract:
 *   - Runs ONLY on the server (no "use client" directive here)
 *   - AWS_API_SECRET is read from server-side env — never sent to the browser
 *   - Plain-text password travels over TLS from form → this action → backend only
 *   - Backend handles bcrypt hashing (cost 12) — we do NOT hash here
 *
 * The action accepts { name, email, password } and injects lawyerId server-side
 * from env/config so the form never needs to know about it.
 *
 * Return shape (ActionResult) is designed for direct use in the register UI:
 *   { ok: true, email }           — 201 success
 *   { ok: false, code, message }  — 400 / 409 / 5xx failure
 */

"use server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type ActionResult =
  | { ok: true; email: string }
  | { ok: false; code: "VALIDATION" | "DUPLICATE_EMAIL" | "SERVER_ERROR"; message: string };

// ── Environment guard ─────────────────────────────────────────────────────────

function getEnv(): { apiUrl: string; secret: string; lawyerId: string } {
  const apiUrl   = process.env.NEXT_PUBLIC_AWS_API_URL;
  const secret   = process.env.AWS_API_SECRET;
  const lawyerId = process.env.DEFAULT_LAWYER_ID; // set after running seed-dummy-lawyer.js

  const missing: string[] = [];
  if (!apiUrl)   missing.push("NEXT_PUBLIC_AWS_API_URL");
  if (!secret)   missing.push("AWS_API_SECRET");
  if (!lawyerId) missing.push("DEFAULT_LAWYER_ID");

  if (missing.length > 0) {
    throw new Error(
      `[registerClient] Missing server env vars: ${missing.join(", ")}. ` +
      "Check .env.local and ensure seed-dummy-lawyer.js has been run."
    );
  }

  return { apiUrl: apiUrl!.replace(/\/$/, ""), secret: secret!, lawyerId: lawyerId! };
}

// ── Input validation (lightweight — backend validates too) ────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(input: RegisterInput): string | null {
  if (!input.name.trim() || input.name.trim().length < 2)
    return "Full name must be at least 2 characters.";
  if (!input.email.trim() || !EMAIL_RE.test(input.email.trim()))
    return "A valid email address is required.";
  if (!input.password || input.password.length < 8)
    return "Password must be at least 8 characters.";
  return null;
}

// ── Server Action ─────────────────────────────────────────────────────────────

export async function registerClient(input: RegisterInput): Promise<ActionResult> {
  // Client-side validation mirrors should have caught this, but guard anyway
  const validationError = validate(input);
  if (validationError) {
    return { ok: false, code: "VALIDATION", message: validationError };
  }

  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (err) {
    console.error("[registerClient] Configuration error:", (err as Error).message);
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: "Server configuration error. Please contact support.",
    };
  }

  const { apiUrl, secret, lawyerId } = env;

  // ── POST /api/v1/clients ──────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // ⚠️ Bearer token — server-only, NEVER reaches the browser
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        name:     input.name.trim(),
        email:    input.email.trim().toLowerCase(),
        password: input.password,   // backend hashes this with bcrypt cost 12
        lawyerId,                   // injected server-side, never from form
      }),
      // Disable Next.js caching — mutation must always be fresh
      cache: "no-store",
    });
  } catch (err) {
    console.error("[registerClient] Network error reaching backend:", err);
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: "Unable to connect to the registration service. Please try again.",
    };
  }

  // ── Map backend status codes ──────────────────────────────────────────────

  // 201 — Client Created Successfully
  if (response.status === 201) {
    console.log(`[registerClient] Registration succeeded for ${input.email}`);
    return { ok: true, email: input.email.trim().toLowerCase() };
  }

  // Parse error body for all non-201 responses
  let errorBody: { error?: string } = {};
  try {
    errorBody = await response.json();
  } catch {
    // Ignore parse failure — we'll fall through to a generic message
  }

  // 409 — Duplicate email
  if (response.status === 409) {
    return {
      ok: false,
      code: "DUPLICATE_EMAIL",
      message: "This email is already registered. Try signing in instead.",
    };
  }

  // 400 — Validation failure (backend rejected field)
  if (response.status === 400) {
    return {
      ok: false,
      code: "VALIDATION",
      message: errorBody.error ?? "Invalid registration data. Please check your details.",
    };
  }

  // 401 — Misconfigured secret (should never reach users in production)
  if (response.status === 401) {
    console.error("[registerClient] 401 Unauthorized — AWS_API_SECRET mismatch with backend API_BEARER_TOKEN");
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: "Registration service configuration error. Please contact support.",
    };
  }

  // 500 / fallthrough
  console.error(
    `[registerClient] Unexpected backend response ${response.status}:`,
    errorBody.error ?? "(no body)"
  );
  return {
    ok: false,
    code: "SERVER_ERROR",
    message: "Registration failed due to a server error. Please try again later.",
  };
}
