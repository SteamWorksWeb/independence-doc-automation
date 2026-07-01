/**
 * src/app/verify/page.tsx
 *
 * Email Verification Processing Page — Server Component
 *
 * Triggered when the client clicks the magic link in their inbox:
 *   {FRONTEND_URL}/verify?token=<raw_hex_token>
 *
 * Flow:
 *   1. Extract ?token from searchParams (SSR — no client JS needed)
 *   2. Missing token → render "invalid link" error state immediately
 *   3. Call GET /api/v1/clients/verify?token=<value> (no auth header — public route)
 *   4. 200 OK → render success card + auto-redirect countdown to /login
 *   5. 400 (expired / invalid) → render appropriate error card
 *   6. 5xx / network → render generic error card
 *
 * No caching — every request hits the backend fresh so tokens are consumed
 * exactly once and expiry is always evaluated in real time.
 */

import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import RedirectCountdown from "./RedirectCountdown";

export const metadata: Metadata = {
  title: "Verify Email — Independence Law Client Portal",
  description: "Email address verification for The Independence Law Firm Client Portal.",
  robots: { index: false, follow: false },
};

// Force dynamic — token expiry must be evaluated at request time, never cached
export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type VerifyState =
  | { status: "success"; message: string }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "missing" }
  | { status: "server_error" };

// ── API call ──────────────────────────────────────────────────────────────────

async function verifyToken(token: string): Promise<VerifyState> {
  const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/$/, "");
  if (!apiUrl) {
    console.error("[verify] Missing NEXT_PUBLIC_AWS_API_URL");
    return { status: "server_error" };
  }

  let response: Response;
  try {
    response = await fetch(
      `${apiUrl}/clients/verify?token=${encodeURIComponent(token)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error("[verify] Network error:", err);
    return { status: "server_error" };
  }

  let body: Record<string, unknown> = {};
  try {
    body = await response.json();
  } catch {
    /* ignore */
  }

  if (response.status === 200) {
    return {
      status: "success",
      message:
        (body.message as string | undefined) ??
        "Email address verified successfully. You may now log in to the Independence Law Client Portal.",
    };
  }

  if (response.status === 400) {
    const errorMsg = (body.error as string | undefined) ?? "";
    if (errorMsg.toLowerCase().includes("expired")) {
      return { status: "expired" };
    }
    return { status: "invalid" };
  }

  console.error(`[verify] Unexpected backend response ${response.status}:`, body.error);
  return { status: "server_error" };
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  // Determine verification state
  const state: VerifyState = token?.trim()
    ? await verifyToken(token.trim())
    : { status: "missing" };

  return (
    <div className={styles.root}>
      {/* Brand mark — top-left */}
      <header className={styles.brand} aria-label="Firm identity">
        <ScalesIcon />
        <div className={styles.brandText}>
          <span className={styles.brandThe}>THE</span>
          <span className={styles.brandName}>Independence Law Firm</span>
        </div>
      </header>

      {/* Centred card */}
      <main className={styles.center}>
        <div className={`${styles.card} animate-fade-in`}>
          {state.status === "success" && <SuccessCard message={state.message} />}
          {state.status === "expired" && <ExpiredCard />}
          {state.status === "invalid" && <InvalidCard />}
          {state.status === "missing" && <InvalidCard />}
          {state.status === "server_error" && <ServerErrorCard />}
        </div>
      </main>

      <footer className={styles.footer} aria-hidden>
        Client Portal
      </footer>
    </div>
  );
}

// ── State cards ───────────────────────────────────────────────────────────────

function SuccessCard({ message }: { message: string }) {
  return (
    <>
      <div className={styles.iconRing} data-variant="success" aria-hidden>
        <CheckIcon />
      </div>
      <div className={styles.body}>
        <h1 className={styles.title}>
          Email <em>Verified</em>
        </h1>
        <p className={styles.subtitle}>{message}</p>
        <div className={`alert alert--success ${styles.redirectAlert}`} role="status" aria-live="polite">
          <RedirectCountdown seconds={3} href="/login" />
        </div>
        <Link href="/login" className={`btn btn--primary ${styles.cta}`} id="verify-login-link">
          Sign In Now
        </Link>
      </div>
    </>
  );
}

function ExpiredCard() {
  return (
    <>
      <div className={styles.iconRing} data-variant="warning" aria-hidden>
        <ClockIcon />
      </div>
      <div className={styles.body}>
        <h1 className={styles.title}>
          Link <em>Expired</em>
        </h1>
        <p className={styles.subtitle}>
          Your verification link has expired. Verification links are valid for{" "}
          <strong>24 hours</strong> from the time they are sent.
        </p>
        <div className={`alert alert--error ${styles.redirectAlert}`} role="alert">
          Please contact your lawyer to request a new verification email.
        </div>
        <Link href="/" className={`btn btn--ghost ${styles.cta}`} id="verify-expired-home-link">
          Return to Home
        </Link>
      </div>
    </>
  );
}

function InvalidCard() {
  return (
    <>
      <div className={styles.iconRing} data-variant="error" aria-hidden>
        <XIcon />
      </div>
      <div className={styles.body}>
        <h1 className={styles.title}>
          Invalid <em>Link</em>
        </h1>
        <p className={styles.subtitle}>
          This verification link is invalid or has already been used. Each link
          can only be clicked once.
        </p>
        <div className={`alert alert--error ${styles.redirectAlert}`} role="alert">
          If you believe this is an error, please contact your lawyer.
        </div>
        <Link href="/" className={`btn btn--ghost ${styles.cta}`} id="verify-invalid-home-link">
          Return to Home
        </Link>
      </div>
    </>
  );
}

function ServerErrorCard() {
  return (
    <>
      <div className={styles.iconRing} data-variant="error" aria-hidden>
        <XIcon />
      </div>
      <div className={styles.body}>
        <h1 className={styles.title}>
          Something Went <em>Wrong</em>
        </h1>
        <p className={styles.subtitle}>
          We were unable to process your verification at this time. Please try
          again in a few moments.
        </p>
        <Link href="/" className={`btn btn--ghost ${styles.cta}`} id="verify-error-home-link">
          Return to Home
        </Link>
      </div>
    </>
  );
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ScalesIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="rgba(179,30,60,0.12)" />
      <g stroke="#1a2744" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="24" y1="12" x2="24" y2="38" />
        <line x1="14" y1="16" x2="34" y2="16" />
        <line x1="14" y1="16" x2="11" y2="26" />
        <line x1="14" y1="16" x2="17" y2="26" />
        <path d="M11 26 Q14 29 17 26" fill="none" />
        <line x1="34" y1="16" x2="31" y2="26" />
        <line x1="34" y1="16" x2="37" y2="26" />
        <path d="M31 26 Q34 29 37 26" fill="none" />
        <line x1="20" y1="38" x2="28" y2="38" />
      </g>
    </svg>
  );
}
