"use client";

/**
 * src/components/admin/EligibilityEngine.tsx
 *
 * Eligibility Engine — backend-powered scorecard UI.
 *
 * On mount, automatically fetches the eligibility score from the backend
 * via the internal Next.js proxy at:
 *   GET /api/admin/clients/{clientId}/eligibility
 *
 * The proxy reads the HttpOnly admin_session cookie server-side and forwards
 * it as a Bearer token to the Render backend. This component never touches
 * the cookie directly — it simply calls the internal proxy URL.
 *
 * UI states:
 *   loading  — Spinner while the fetch is in-flight
 *   error    — Generic error with a retry button
 *   no-intake — 422 from backend (client hasn't completed intake yet)
 *   result   — Full scorecard (score, status band, reasons breakdown)
 *
 * Props:
 *   clientId — UUID of the client to evaluate (required)
 */

import React, { useEffect, useState, useCallback } from "react";
import styles from "./Eligibility.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type EligibilityStatus = "Highly Eligible" | "Review Required" | "Ineligible";

interface EligibilityResult {
  score: number;
  status: EligibilityStatus;
  reasons: string[];
}

type Phase =
  | { kind: "loading" }
  | { kind: "no-intake" }
  | { kind: "error"; message: string }
  | { kind: "result"; data: EligibilityResult; fetchedAt: Date };

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  // Legacy prop — retained so existing call-sites that still pass intakeProfile
  // don't break. Not used for scoring (backend owns the algorithm).
  intakeProfile?: unknown;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EligibilityEngine({ clientId }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const runFetch = useCallback(async () => {
    setPhase({ kind: "loading" });

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/eligibility`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        // No-cache: always get a fresh score when the tab is revisited.
        cache: "no-store",
      });

      // 422 → client hasn't submitted intake yet
      if (res.status === 422) {
        setPhase({ kind: "no-intake" });
        return;
      }

      // 404 → client record not found (edge case)
      if (res.status === 404) {
        setPhase({ kind: "no-intake" });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setPhase({
          kind: "error",
          message: body.message ?? `Unexpected error (HTTP ${res.status}).`,
        });
        return;
      }

      const json = await res.json() as {
        eligibility?: EligibilityResult;
        // legacy Brunner shape (backward-compat in case proxy returns old format)
        analysis?: { overallScore?: string; isProng1Met?: boolean; isProng2Met?: boolean };
      };

      if (json.eligibility) {
        setPhase({ kind: "result", data: json.eligibility, fetchedAt: new Date() });
      } else {
        // Shouldn't happen with the updated backend, but guard gracefully
        setPhase({ kind: "error", message: "Received an unrecognised response from the server." });
      }
    } catch {
      setPhase({ kind: "error", message: "Network error. Check your connection and try again." });
    }
  }, [clientId]);

  // Fetch automatically on mount (and when clientId changes)
  useEffect(() => {
    runFetch();
  }, [runFetch]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase.kind === "loading") return <LoadingView />;
  if (phase.kind === "no-intake") return <NoIntakeView />;
  if (phase.kind === "error") return <ErrorView message={phase.message} onRetry={runFetch} />;
  return <ResultView result={phase.data} fetchedAt={phase.fetchedAt} onRefresh={runFetch} />;
}

// ── Loading view ──────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className={styles.container}>
      <div className={styles.loadingState}>
        <div className={styles.spinner} aria-hidden />
        <p className={`${styles.loadingLabel} ${styles.loadingDots}`}>
          Calculating eligibility score
        </p>
      </div>
    </div>
  );
}

// ── No-intake view ────────────────────────────────────────────────────────────

function NoIntakeView() {
  return (
    <div className={styles.container}>
      <div className={styles.errorState}>
        <div className={styles.engineIcon}>
          <ClockIcon />
        </div>
        <p className={styles.idleTitle}>Intake Incomplete</p>
        <p className={styles.idleSubtitle}>
          Intake incomplete. Waiting on client data to generate score.
        </p>
      </div>
    </div>
  );
}

// ── Error view ────────────────────────────────────────────────────────────────

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.container}>
      <div className={styles.errorState}>
        <div className={styles.errorBadge}>
          <AlertIcon />
          <span>Error</span>
        </div>
        <p className={styles.idleSubtitle}>{message}</p>
        <button id="eligibility-retry-btn" className={styles.runBtn} onClick={onRetry}>
          <RerunIcon /> Retry
        </button>
      </div>
    </div>
  );
}

// ── Result view ───────────────────────────────────────────────────────────────

function ResultView({
  result,
  fetchedAt,
  onRefresh,
}: {
  result: EligibilityResult;
  fetchedAt: Date;
  onRefresh: () => void;
}) {
  const { score, status, reasons } = result;

  const cfg = {
    "Highly Eligible": {
      bannerClass: styles.scoreBannerHigh,
      verdictClass: styles.scoreVerdictHigh,
      pillClass: styles.scorePillHigh,
      barClass: styles.progressBarHigh,
      description:
        "This client presents strong indicators for student loan discharge. Recommend proceeding with a full case evaluation.",
    },
    "Review Required": {
      bannerClass: styles.scoreBannerMedium,
      verdictClass: styles.scoreVerdictMedium,
      pillClass: styles.scorePillMedium,
      barClass: styles.progressBarMedium,
      description:
        "Mixed indicators. Additional documentation or legal strategy may be needed to build a viable hardship case.",
    },
    Ineligible: {
      bannerClass: styles.scoreBannerLow,
      verdictClass: styles.scoreVerdictLow,
      pillClass: styles.scorePillLow,
      barClass: styles.progressBarLow,
      description:
        "Current financial profile does not meet discharge criteria. Consider financial counselling or revisiting in 12 months.",
    },
  }[status];

  return (
    <div className={styles.container}>
      <div className={styles.report}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className={styles.reportHeader}>
          <div>
            <p className={styles.reportTitle}>Eligibility Score Report</p>
            <p className={styles.reportMeta}>
              Generated{" "}
              {fetchedAt.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            id="eligibility-refresh-btn"
            className={styles.rerunBtn}
            onClick={onRefresh}
          >
            <RerunIcon /> Refresh
          </button>
        </div>

        {/* ── Score banner ─────────────────────────────────────────────────── */}
        <div className={`${styles.scoreBanner} ${cfg.bannerClass}`}>
          <div className={styles.scoreBannerLeft}>
            <span className={styles.scoreLabel}>Overall Verdict</span>
            <p className={`${styles.scoreVerdict} ${cfg.verdictClass}`}>{status}</p>
            <p className={styles.scoreDescription}>{cfg.description}</p>
          </div>

          {/* Big numeric score */}
          <div className={styles.scoreCircle}>
            <span className={`${styles.scoreNumber} ${cfg.verdictClass}`}>{score}</span>
            <span className={styles.scoreDenom}>/100</span>
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>Score</span>
            <span className={`${styles.scorePill} ${cfg.pillClass}`}>{score} pts</span>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`${styles.progressBar} ${cfg.barClass}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className={styles.progressTicks}>
            <span>0</span>
            <span>Ineligible</span>
            <span className={styles.tickMid}>45 — Review</span>
            <span>70 — Eligible</span>
            <span>100</span>
          </div>
        </div>

        {/* ── Score breakdown ──────────────────────────────────────────────── */}
        <div className={styles.financialsSection}>
          <p className={styles.sectionLabel}>Score Breakdown</p>
          <div className={styles.reasonsTable}>
            {reasons.map((reason, i) => {
              // Parse the delta sign from the reason string so we can apply
              // the correct colour class (backend sends plain text reasons).
              const isPositive = reason.includes("(+") || reason.includes("+");
              const isNegative = reason.includes("(−") || reason.includes("−") || reason.includes("(-") || reason.includes("-20") || reason.includes("-5");
              const deltaClass =
                i === 0
                  ? styles.reasonDeltaBase   // "Base score" row
                  : isNegative
                  ? styles.reasonDeltaNeg
                  : isPositive
                  ? styles.reasonDeltaPos
                  : styles.reasonDeltaBase;

              return (
                <div key={i} className={styles.reasonRow}>
                  <span className={styles.reasonLabel}>{reason}</span>
                  <span className={`${styles.reasonDelta} ${deltaClass}`} aria-hidden />
                </div>
              );
            })}
            {/* Total row */}
            <div className={`${styles.reasonRow} ${styles.reasonRowTotal}`}>
              <span className={styles.reasonLabel}>
                <strong>Final Score</strong>
              </span>
              <span className={`${styles.reasonDelta} ${cfg.verdictClass}`}>
                <strong>{score} / 100</strong>
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#818cf8"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function RerunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  );
}
