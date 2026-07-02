/**
 * src/app/dashboard/page.tsx
 *
 * Client Dashboard — Conditional Rendering Gateway
 *
 * This is a React Server Component that determines what the logged-in
 * client should see based on their intake status:
 *
 *   State A (Incomplete): Renders the IntakeWizard component so the
 *   client can complete their DOJ Student Loan Questionnaire.
 *
 *   State B (Complete): Renders the full dashboard home screen with
 *   case status, next steps, and a confidence-inspiring overview.
 *
 * Auth pattern:
 *   - Reads `client_token` HttpOnly cookie via next/headers
 *   - Fetches the client's intake profile from the Render backend
 *     through the /api/intake Next.js proxy (which forwards the cookie)
 *   - Falls back gracefully on error
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import IntakeWizard from "@/components/intake/IntakeWizard";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "My Dashboard",
};

export const maxDuration = 60; // Allow 60s for Render cold starts

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntakeProfile {
  isCompleted: boolean;
  [key: string]: unknown;
}

// ── Fetch intake status ───────────────────────────────────────────────────────

async function fetchIntakeStatus(): Promise<{
  profile: IntakeProfile | null;
  error: string | null;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get("client_token")?.value;

  if (!token) {
    console.error("[dashboard] No client_token cookie found.");
    return { profile: null, error: "Unauthorized: No active session." };
  }

  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error("[dashboard] NEXT_PUBLIC_AWS_API_URL is undefined.");
    return { profile: null, error: "Server configuration error." };
  }

  // Strip /api/v1 suffix — intake lives at /api/v1/intake
  const targetUrl = `${backendBase}/intake`;
  console.log(`[dashboard] Fetching intake profile: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    console.log(`[dashboard] Backend responded: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(unreadable)");
      console.error(`[dashboard] Backend returned ${res.status}: ${errorText.slice(0, 300)}`);
      return { profile: null, error: "Failed to load profile. Please try again." };
    }

    const data = await res.json();
    const profile: IntakeProfile | null = data.intakeProfile ?? null;
    console.log(`[dashboard] Intake profile loaded. isCompleted: ${profile?.isCompleted ?? "null"}`);
    return { profile, error: null };
  } catch (err) {
    console.error("[dashboard] FETCH EXCEPTION:", err);
    return {
      profile: null,
      error: `Network error: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { profile, error } = await fetchIntakeStatus();

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`${styles.page} animate-fade-in`}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>
            <AlertIcon />
          </div>
          <p className={styles.errorTitle}>Unable to Load Dashboard</p>
          <p className={styles.errorBody}>{error}</p>
        </div>
      </div>
    );
  }

  // ── State A: Intake not complete → show the wizard ──────────────────────────
  if (!profile || !profile.isCompleted) {
    return <IntakeWizard />;
  }

  // ── State B: Intake complete → show the dashboard home ──────────────────────
  return (
    <div className={`${styles.page} animate-fade-in`}>

      {/* ── Welcome header ────────────────────────────────── */}
      <div className={styles.welcomeHeader}>
        <h1 className={styles.welcomeTitle}>Welcome to Your Portal</h1>
        <p className={styles.welcomeSubtitle}>
          Your intake questionnaire has been submitted. Here's an overview of your case status.
        </p>
      </div>

      {/* ── Status cards ──────────────────────────────────── */}
      <div className={styles.cardGrid}>
        <div className={styles.statusCard}>
          <div className={`${styles.cardIcon} ${styles.cardIconGreen}`}>
            <CheckCircleIcon />
          </div>
          <h2 className={styles.cardTitle}>Intake Submitted</h2>
          <p className={styles.cardDescription}>
            Your DOJ Student Loan Questionnaire has been received and is under attorney review.
          </p>
          <span className={`${styles.cardBadge} ${styles.cardBadgeGreen}`}>
            <DotIcon /> Complete
          </span>
        </div>

        <div className={styles.statusCard}>
          <div className={`${styles.cardIcon} ${styles.cardIconBlue}`}>
            <FileSearchIcon />
          </div>
          <h2 className={styles.cardTitle}>Case Review</h2>
          <p className={styles.cardDescription}>
            Your attorney is reviewing your financial information and preparing the eligibility analysis.
          </p>
          <span className={`${styles.cardBadge} ${styles.cardBadgeBlue}`}>
            <DotIcon /> In Progress
          </span>
        </div>

        <div className={styles.statusCard}>
          <div className={`${styles.cardIcon} ${styles.cardIconAmber}`}>
            <DocumentIcon />
          </div>
          <h2 className={styles.cardTitle}>Documents</h2>
          <p className={styles.cardDescription}>
            Your attorney may request additional documents. You'll be notified via email.
          </p>
          <span className={`${styles.cardBadge} ${styles.cardBadgeAmber}`}>
            <DotIcon /> Awaiting
          </span>
        </div>
      </div>

      {/* ── What to expect ────────────────────────────────── */}
      <div className={styles.infoCard}>
        <div className={styles.infoCardHeader}>
          <h2 className={styles.infoCardTitle}>What Happens Next</h2>
        </div>
        <div className={styles.infoCardBody}>
          <ol className={styles.stepsList}>
            <li className={styles.stepsItem}>
              <span className={styles.stepNumber}>1</span>
              <span className={styles.stepText}>
                <span className={styles.stepTextStrong}>Attorney Review</span> — Your attorney will review your questionnaire responses and financial data within 2-3 business days.
              </span>
            </li>
            <li className={styles.stepsItem}>
              <span className={styles.stepNumber}>2</span>
              <span className={styles.stepText}>
                <span className={styles.stepTextStrong}>Eligibility Analysis</span> — A Brunner Test analysis will determine your eligibility for student loan discharge under 11 U.S.C. § 523(a)(8).
              </span>
            </li>
            <li className={styles.stepsItem}>
              <span className={styles.stepNumber}>3</span>
              <span className={styles.stepText}>
                <span className={styles.stepTextStrong}>Strategy Call</span> — Your attorney will schedule a consultation to discuss the results and outline next steps for your case.
              </span>
            </li>
            <li className={styles.stepsItem}>
              <span className={styles.stepNumber}>4</span>
              <span className={styles.stepText}>
                <span className={styles.stepTextStrong}>Filing</span> — If you qualify, your attorney will prepare and file the adversary proceeding on your behalf.
              </span>
            </li>
          </ol>
        </div>
      </div>

      {/* ── Trust footer ──────────────────────────────────── */}
      <div className={styles.trustStrip}>
        <span className={styles.trustItem}>
          <LockIcon /> 256-bit Encrypted
        </span>
        <span className={styles.trustDot} aria-hidden>•</span>
        <span className={styles.trustItem}>
          <ShieldIcon /> Attorney-Client Privilege
        </span>
        <span className={styles.trustDot} aria-hidden>•</span>
        <span className={styles.trustItem}>
          <ClockIcon /> Response within 48 hours
        </span>
      </div>
    </div>
  );
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

function AlertIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function FileSearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="11" cy="15" r="3" />
      <line x1="13.5" y1="17" x2="16" y2="19.5" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="6" height="6" aria-hidden>
      <circle cx="3" cy="3" r="3" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
