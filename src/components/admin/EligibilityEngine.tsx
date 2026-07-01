"use client";

/**
 * src/components/admin/EligibilityEngine.tsx
 *
 * Brunner Test Eligibility Engine — client-side interactive analysis tool.
 *
 * Renders a "Run Eligibility Analysis" trigger button on mount, fetches the
 * backend Brunner score via the Next.js proxy route, then presents the results
 * as a premium report card with colour-coded verdict (HIGH / MEDIUM / LOW).
 *
 * Props:
 *   clientId — the UUID of the client to analyse
 */

import React, { useState, useCallback } from "react";
import styles from "./Eligibility.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EligibilityResult {
  totalExpenses: number;
  disposableIncome: number;
  isProng1Met: boolean;
  isProng2Met: boolean;
  overallScore: "HIGH" | "MEDIUM" | "LOW";
}

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "result"; data: EligibilityResult; fetchedAt: Date };

// ── Component ─────────────────────────────────────────────────────────────────

export default function EligibilityEngine({ clientId }: { clientId: string }) {
  const [state, setState] = useState<State>({ phase: "idle" });

  const runAnalysis = useCallback(async () => {
    setState({ phase: "loading" });

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/eligibility`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        let msg = `Server returned ${res.status}`;
        try {
          const body = await res.json();
          if (body?.message) msg = body.message;
        } catch { /* ignore */ }
        setState({ phase: "error", message: msg });
        return;
      }

      const data: EligibilityResult = await res.json();
      setState({ phase: "result", data, fetchedAt: new Date() });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Unknown network error.",
      });
    }
  }, [clientId]);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  if (state.phase === "idle") return <IdleView onRun={runAnalysis} />;
  if (state.phase === "loading") return <LoadingView />;
  if (state.phase === "error") return <ErrorView message={state.message} onRetry={runAnalysis} />;
  return <ResultView data={state.data} fetchedAt={state.fetchedAt} onRerun={reset} />;
}

// ── Idle view ─────────────────────────────────────────────────────────────────

function IdleView({ onRun }: { onRun: () => void }) {
  return (
    <div className={styles.container}>
      <div className={styles.idleState}>
        <div className={styles.engineIcon}>
          <ScaleIcon />
        </div>
        <p className={styles.idleTitle}>Brunner Test Eligibility Engine</p>
        <p className={styles.idleSubtitle}>
          Run an automated analysis of this client&apos;s financial data against the
          three-prong Brunner Test to assess their eligibility for student loan
          discharge under 11 U.S.C. § 523(a)(8).
        </p>
        <button
          id="eligibility-run-btn"
          className={styles.runBtn}
          onClick={onRun}
        >
          <RunIcon />
          Run Eligibility Analysis
        </button>
      </div>
    </div>
  );
}

// ── Loading view ──────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className={styles.container}>
      <div className={styles.loadingState}>
        <div className={styles.spinner} aria-hidden />
        <p className={styles.loadingLabel}>
          Calculating Brunner Variables
          <span className={styles.loadingDots} aria-label="Loading" />
        </p>
      </div>
    </div>
  );
}

// ── Error view ────────────────────────────────────────────────────────────────

function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.errorState}>
        <span className={styles.errorBadge}>
          <ErrorIcon /> Analysis Failed
        </span>
        <p className={styles.errorMessage}>{message}</p>
        <button className={styles.runBtn} onClick={onRetry}>
          <RunIcon /> Retry Analysis
        </button>
      </div>
    </div>
  );
}

// ── Result view ───────────────────────────────────────────────────────────────

function ResultView({
  data,
  fetchedAt,
  onRerun,
}: {
  data: EligibilityResult;
  fetchedAt: Date;
  onRerun: () => void;
}) {
  const { totalExpenses, disposableIncome, isProng1Met, isProng2Met, overallScore } = data;

  const scoreConfig = {
    HIGH: {
      bannerClass: styles.scoreBannerHigh,
      pillClass: styles.scorePillHigh,
      verdictClass: styles.scoreVerdictHigh,
      verdict: "HIGH ELIGIBILITY",
      description:
        "This client presents a strong case for discharge. Both financial prongs are met, indicating genuine and persistent undue hardship.",
    },
    MEDIUM: {
      bannerClass: styles.scoreBannerMedium,
      pillClass: styles.scorePillMedium,
      verdictClass: styles.scoreVerdictMedium,
      verdict: "MEDIUM ELIGIBILITY",
      description:
        "This client meets some but not all prongs. Additional evidence or legal strategy may be required to demonstrate undue hardship.",
    },
    LOW: {
      bannerClass: styles.scoreBannerLow,
      pillClass: styles.scorePillLow,
      verdictClass: styles.scoreVerdictLow,
      verdict: "LOW ELIGIBILITY",
      description:
        "This client currently does not meet the Brunner Test criteria. Further financial counselling or stronger documentation is recommended.",
    },
  }[overallScore];

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);

  const timeStr = fetchedAt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={styles.container}>
      <div className={styles.report}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className={styles.reportHeader}>
          <div>
            <p className={styles.reportTitle}>Brunner Test — Eligibility Report</p>
            <p className={styles.reportMeta}>Generated at {timeStr}</p>
          </div>
          <button
            id="eligibility-rerun-btn"
            className={styles.rerunBtn}
            onClick={onRerun}
          >
            <RerunIcon /> Re-run Analysis
          </button>
        </div>

        {/* ── Overall score banner ──────────────────────────────────────── */}
        <div className={`${styles.scoreBanner} ${scoreConfig.bannerClass}`}>
          <div className={styles.scoreBannerLeft}>
            <span className={styles.scoreLabel}>Overall Verdict</span>
            <p className={`${styles.scoreVerdict} ${scoreConfig.verdictClass}`}>
              {scoreConfig.verdict}
            </p>
            <p className={styles.scoreDescription}>{scoreConfig.description}</p>
          </div>
          <span className={`${styles.scorePill} ${scoreConfig.pillClass}`}>
            {overallScore}
          </span>
        </div>

        {/* ── Prong cards ───────────────────────────────────────────────── */}
        <div className={styles.prongGrid}>
          <ProngCard
            name="Prong 1"
            title="Minimal Standard of Living"
            description="Debtor cannot maintain a minimal standard of living for themselves and their dependents if forced to repay the loans."
            isMet={isProng1Met}
          />
          <ProngCard
            name="Prong 2"
            title="Persistence of Hardship"
            description="Additional circumstances exist indicating that this state of affairs is likely to persist for a significant portion of the repayment period."
            isMet={isProng2Met}
          />
        </div>

        {/* ── Financial breakdown ───────────────────────────────────────── */}
        <div className={styles.financialsSection}>
          <p className={styles.sectionLabel}>Financial Variables</p>
          <div className={styles.financialsGrid}>
            <FinancialCard
              label="Total Monthly Expenses"
              value={fmt(totalExpenses)}
              sentiment="neutral"
            />
            <FinancialCard
              label="Disposable Income"
              value={fmt(disposableIncome)}
              sentiment={disposableIncome <= 0 ? "negative" : "positive"}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProngCard({
  name,
  title,
  description,
  isMet,
}: {
  name: string;
  title: string;
  description: string;
  isMet: boolean;
}) {
  return (
    <div
      className={`${styles.prongCard} ${
        isMet ? styles.prongCardMet : styles.prongCardNotMet
      }`}
    >
      <div className={styles.prongHeader}>
        <span className={styles.prongName}>{name}</span>
        <span
          className={`${styles.prongStatus} ${
            isMet ? styles.prongStatusMet : styles.prongStatusNotMet
          }`}
        >
          {isMet ? <CheckIcon /> : <XIcon />}
          {isMet ? "Met" : "Not Met"}
        </span>
      </div>
      <p className={styles.prongTitle}>{title}</p>
      <p className={styles.prongDesc}>{description}</p>
    </div>
  );
}

function FinancialCard({
  label,
  value,
  sentiment,
}: {
  label: string;
  value: string;
  sentiment: "positive" | "negative" | "neutral";
}) {
  const valueClass =
    sentiment === "negative"
      ? styles.financialCardValueNegative
      : sentiment === "positive"
      ? styles.financialCardValuePositive
      : styles.financialCardValue;

  return (
    <div className={styles.financialCard}>
      <span className={styles.financialCardLabel}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function ScaleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function RunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function RerunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
