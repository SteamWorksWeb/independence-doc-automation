/**
 * src/types/auth.ts
 *
 * Shared TypeScript interfaces for the Independence Law client auth domain.
 *
 * Used by:
 *   - src/actions/loginClient.ts   (Server Action return type)
 *   - src/components/auth/ClientLoginForm.tsx (UI consumption)
 *   - src/middleware.ts             (JWT payload shape)
 */

// ── Client session shape (returned by POST /login) ────────────────────────────

export interface ClientSession {
  id: string;
  name: string;
  email: string;
  lawyerId: string;
}

// ── Server Action result union ────────────────────────────────────────────────

export type LoginResult =
  | { ok: true; client: ClientSession }
  | {
      ok: false;
      code:
        | "VALIDATION"         // 400 — missing/blank fields (client-side guard)
        | "INVALID_CREDENTIALS" // 401 — wrong email or password
        | "UNVERIFIED"          // 403 — correct creds but isVerified = false
        | "SERVER_ERROR";       // 500 / network failure
      message: string;
    };

// ── POST /login success response shape (raw backend) ─────────────────────────

export interface LoginApiResponse {
  token: string;
  client: ClientSession;
}
