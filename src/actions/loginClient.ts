/**
 * src/actions/loginClient.ts
 *
 * Next.js Server Action — Client Login
 *
 * Security contract:
 *   - Runs ONLY on the server ("use server" directive)
 *   - No Authorization header sent — POST /login is a public backend route
 *   - JWT stored in an httpOnly; Secure; SameSite=Lax cookie named `client_token`
 *   - Cookie max-age mirrors the backend JWT_EXPIRES_IN (7 days = 604800 seconds)
 *   - Plain-text password travels over TLS only — never logged, never returned
 *
 * Return shape (LoginResult) is designed for direct use in ClientLoginForm:
 *   { ok: true, client }                          — 200 success
 *   { ok: false, code: "UNVERIFIED", message }    — 403 (email not verified)
 *   { ok: false, code: "INVALID_CREDENTIALS", … } — 401
 *   { ok: false, code: "VALIDATION", … }          — 400 / missing fields
 *   { ok: false, code: "SERVER_ERROR", … }        — 500 / network
 */

"use server";

import { cookies } from "next/headers";
import type { LoginResult, LoginApiResponse } from "@/types/auth";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Cookie name — must match the middleware reader. */
const COOKIE_NAME = "client_token";

/** 7 days in seconds — mirrors backend JWT_EXPIRES_IN default. */
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

// ── Environment guard ─────────────────────────────────────────────────────────

function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!url) {
    throw new Error(
      "[loginClient] Missing required env var: NEXT_PUBLIC_AWS_API_URL. " +
        "Check .env.local."
    );
  }
  return url.replace(/\/$/, ""); // strip trailing slash
}

// ── Input validation ──────────────────────────────────────────────────────────

function validate(email: string, password: string): string | null {
  if (!email.trim()) return "Email address is required.";
  if (!password) return "Password is required.";
  return null;
}

// ── Server Action ─────────────────────────────────────────────────────────────

export async function loginClient(
  email: string,
  password: string
): Promise<LoginResult> {
  // ── Client-side mirrors should have caught this, guard anyway ──────────────
  const validationError = validate(email, password);
  if (validationError) {
    return { ok: false, code: "VALIDATION", message: validationError };
  }

  // ── Resolve API base URL ───────────────────────────────────────────────────
  let apiUrl: string;
  try {
    apiUrl = getApiUrl();
  } catch (err) {
    console.error("[loginClient] Configuration error:", (err as Error).message);
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: "Server configuration error. Please contact support.",
    };
  }

  // ── POST /api/v1/clients/login ─────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/clients/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
      // Mutations must never be served from cache
      cache: "no-store",
    });
  } catch (err) {
    console.error("[loginClient] Network error reaching backend:", err);
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        "Unable to connect to the login service. Please check your connection and try again.",
    };
  }

  // ── Parse response body ────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = await response.json();
  } catch {
    // Ignore — fall through to status-based handling
  }

  // ── 200 OK — success ───────────────────────────────────────────────────────
  if (response.status === 200) {
    const { token, client } = body as unknown as LoginApiResponse;

    // Write the JWT into an httpOnly cookie — never accessible from JavaScript
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    console.log(`[loginClient] Login succeeded for ${client.email}`);
    return { ok: true, client };
  }

  // ── 401 — Invalid credentials ─────────────────────────────────────────────
  if (response.status === 401) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      // Intentionally vague — mirrors the backend's no-enumeration policy
      message: "Invalid email or password. Please try again.",
    };
  }

  // ── 403 — Email not verified ───────────────────────────────────────────────
  if (response.status === 403) {
    return {
      ok: false,
      code: "UNVERIFIED",
      message:
        (body.error as string | undefined) ??
        "Please verify your email address before logging in. Check your inbox for the verification link.",
    };
  }

  // ── 400 — Missing/invalid fields ──────────────────────────────────────────
  if (response.status === 400) {
    return {
      ok: false,
      code: "VALIDATION",
      message:
        (body.error as string | undefined) ??
        "Invalid login data. Please check your details.",
    };
  }

  // ── 500 / fallthrough ─────────────────────────────────────────────────────
  console.error(
    `[loginClient] Unexpected backend response ${response.status}:`,
    body.error ?? "(no body)"
  );
  return {
    ok: false,
    code: "SERVER_ERROR",
    message: "Login failed due to a server error. Please try again later.",
  };
}
