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

import { cookies } from "next/headers";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  token?: string;  // Invitation token — required by "Velvet Rope" backend
};

export type ActionResult =
  | { ok: true; email: string; tokenized: boolean }
  | { ok: false; code: "VALIDATION" | "DUPLICATE_EMAIL" | "INVALID_TOKEN" | "SERVER_ERROR"; message: string };

// ── Environment guard ─────────────────────────────────────────────────────────

function getEnv(): { apiUrl: string; secret: string } {
  const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
  const secret = process.env.AWS_API_SECRET;

  const missing: string[] = [];
  if (!apiUrl) missing.push("NEXT_PUBLIC_AWS_API_URL");
  if (!secret) missing.push("AWS_API_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `[registerClient] Missing server env vars: ${missing.join(", ")}. ` +
      "Check Vercel environment variables."
    );
  }

  return { apiUrl: apiUrl!.replace(/\/$/, ""), secret: secret! };
}

// ── Input validation (lightweight — backend validates too) ────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(input: RegisterInput): string | null {
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

  const { apiUrl, secret } = env;

  // ── POST /api/v1/clients ──────────────────────────────────────────────────
  //
  // NOTE: apiUrl is already "https://.../api/v1" — do NOT add /api/v1 again.
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
        name:     (input.name?.trim()) || input.email.split("@")[0],  // fallback if empty
        email:    input.email.trim().toLowerCase(),
        password: input.password,   // backend hashes this with bcrypt cost 12
        ...(input.token ? { token: input.token } : {}),  // Velvet Rope invitation token
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
    const normalizedEmail = input.email.trim().toLowerCase();
    console.log(`[registerClient] Registration succeeded for ${normalizedEmail}`);

    const cookieStore = await cookies();

    // ── Auto-login: obtain a JWT so /api/intake proxy routes work immediately ──
    //
    // The registration endpoint returns the new client record but NO token.
    // Without a token, the user lands on /onboarding with no session cookie
    // and every POST /api/intake call returns 401.
    // Fix: immediately call /clients/login with the same credentials to get
    // a JWT, then write client_token the same way loginClient.ts does.
    //
    try {
      const loginRes = await fetch(`${apiUrl}/clients/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: input.password }),
        cache: "no-store",
      });

      if (loginRes.ok) {
        const loginBody = await loginRes.json().catch(() => ({})) as Record<string, unknown>;
        const jwt = typeof loginBody.token === "string" ? loginBody.token : null;

        if (jwt) {
          cookieStore.set("client_token", jwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,  // 7 days — mirrors JWT_EXPIRES_IN
          });
          console.log(`[registerClient] Auto-login succeeded — client_token set for ${normalizedEmail}`);
        } else {
          console.warn("[registerClient] Auto-login response had no token field:", loginBody);
        }
      } else {
        console.warn(`[registerClient] Auto-login failed (HTTP ${loginRes.status}) — user will need to log in manually`);
      }
    } catch (autoLoginErr) {
      // Non-fatal: registration succeeded, user can log in manually
      console.warn("[registerClient] Auto-login network error:", autoLoginErr);
    }

    // ── Write borrower_email cookie for borrower-session email resolution ─────
    try {
      cookieStore.set("borrower_email", normalizedEmail, {
        httpOnly: false,   // borrower-session reads it via cookies() server-side
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,  // 7 days — mirrors JWT lifetime
      });
    } catch (cookieErr) {
      // Non-fatal: onboarding will still work via JWT fallback path
      console.warn("[registerClient] Failed to set borrower_email cookie:", cookieErr);
    }

    return {
      ok: true,
      email: normalizedEmail,
      tokenized: !!input.token,  // true = invite-token flow, skip verify screen
    };
  }


  // Parse error body — capture raw text first so we never lose the backend message
  const rawErrorText = await response.text().catch(() => "");
  console.error(
    `[BACKEND REJECTION] POST /clients → HTTP ${response.status} | URL: ${apiUrl}/clients`,
    "\nRaw body:", rawErrorText || "(empty)"
  );

  let errorBody: { error?: string; message?: string } = {};
  try {
    errorBody = JSON.parse(rawErrorText);
  } catch {
    // Non-JSON body (plain text error) — already logged above
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
      message: errorBody.error ?? errorBody.message ?? "Invalid registration data. Please check your details.",
    };
  }

  // 403 — Invalid or expired invitation token
  if (response.status === 403) {
    return {
      ok: false,
      code: "INVALID_TOKEN",
      message: errorBody.error ?? errorBody.message ?? "This invitation link is invalid or has expired. Please contact your attorney for a new invitation.",
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
