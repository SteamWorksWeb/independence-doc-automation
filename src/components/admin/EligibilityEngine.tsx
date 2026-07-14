"use client";

/**
 * src/components/admin/EligibilityEngine.tsx
 *
 * Eligibility Engine — client-side scoring algorithm + scorecard UI.
 *
 * Receives the client's full intakeProfile as a prop and runs a
 * 100-point scoring algorithm locally (no network call). The scorecard
 * shows a large numeric score, a coloured status badge, an animated
 * progress bar, and a detailed reasons breakdown table.
 *
 * Algorithm (out of 100):
 *   Base score  = 50
 *   Income      < $3 000/mo  → +20   |   > $5 000/mo  → -20
 *   Disability  = true       → +15
 *   Unemployed  (isEmployed=false) → +15
 *   Vehicle     (hasCar)     → -5
 *   Tax refund  (expectingRefund) → -5
 *   Score is clamped to [0, 100].
 *
 * Status:
 *   ≥ 80  → Highly Eligible   (green)
 *   50–79 → Review Required   (amber)
 *   < 50  → Ineligible        (red)
 */

import React, { useMemo, useState, useCallback } from "react";
import styles from "./Eligibility.module.css";
import type { IntakeProfile } from "./ClientProfileTabs";

// ── Algorithm ─────────────────────────────────────────────────────────────────

interface EligibilityResult {
  totalScore: number;
  status: "Highly Eligible" | "Review Required" | "Ineligible";
  reasons: Array<{ label: string; delta: number }>;
}

function calculateEligibility(ip: IntakeProfile | null): EligibilityResult {
  if (!ip) {
    return {
      totalScore: 0,
      status: "Ineligible",
      reasons: [{ label: "No intake questionnaire on file", delta: 0 }],
    };
  }

  let score = 50;
  const reasons: Array<{ label: string; delta: number }> = [
    { label: "Base score", delta: 50 },
  ];

  // ── Income ────────────────────────────────────────────────────────────────
  const income = ip.monthlyIncome ?? 0;
  if (income > 0 && income < 3_000) {
    score += 20;
    reasons.push({ label: `Low income (${fmt(income)}/mo < $3,000)`, delta: 20 });
  } else if (income > 5_000) {
    score -= 20;
    reasons.push({ label: `High income (${fmt(income)}/mo > $5,000)`, delta: -20 });
  }

  // ── Disability ────────────────────────────────────────────────────────────
  if (ip.hasDisability) {
    score += 15;
    reasons.push({ label: "Has a qualifying disability", delta: 15 });
  }

  // ── Employment ────────────────────────────────────────────────────────────
  if (!ip.isEmployed) {
    score += 15;
    reasons.push({ label: "Currently unemployed", delta: 15 });
  }

  // ── Assets ────────────────────────────────────────────────────────────────
  if (ip.hasCar) {
    score -= 5;
    reasons.push({ label: "Owns a vehicle", delta: -5 });
  }
  if (ip.expectingRefund) {
    score -= 5;
    reasons.push({ label: "Expecting a tax refund", delta: -5 });
  }

  // ── Clamp ─────────────────────────────────────────────────────────────────
  const totalScore = Math.max(0, Math.min(100, score));

  const status: EligibilityResult["status"] =
    totalScore >= 80 ? "Highly Eligible" :
    totalScore >= 50 ? "Review Required" :
                       "Ineligible";

  return { totalScore, status, reasons };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  // Legacy prop — kept for compatibility if clientId is still passed somewhere
  clientId?: string;
  // New prop — full intake profile passed directly from the server component
  intakeProfile?: IntakeProfile | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EligibilityEngine({ intakeProfile }: Props) {
  const [ran, setRan] = useState(false);
  const result = useMemo(
    () => (ran ? calculateEligibility(intakeProfile ?? null) : null),
    [ran, intakeProfile]
  );
  const run    = useCallback(() => setRan(true),  []);
  const reset  = useCallback(() => setRan(false), []);

  if (!ran || !result) return <IdleView onRun={run} hasIntake={!!intakeProfile} />;
  return <ResultView result={result} onRerun={reset} />;
}

// ── Idle view ─────────────────────────────────────────────────────────────────

function IdleView({ onRun, hasIntake }: { onRun: () => void; hasIntake: boolean }) {
  return (
    <div className={styles.container}>
      <div className={styles.idleState}>
        <div className={styles.engineIcon}>
          <ScaleIcon />
        </div>
        <p className={styles.idleTitle}>Eligibility Engine</p>
        <p className={styles.idleSubtitle}>
          {hasIntake
            ? "Run the automated scoring algorithm to assess this client's eligibility for student loan discharge. The engine analyses income, disability status, employment, and assets to generate a 0–100 eligibility score."
            : "This client has not yet completed their intake questionnaire. Eligibility scoring requires intake data."}
        </p>
        <button
          id="eligibility-run-btn"
          className={styles.runBtn}
          onClick={onRun}
          disabled={!hasIntake}
        >
          <RunIcon />
          {hasIntake ? "Run Eligibility Analysis" : "Awaiting Intake Data"}
        </button>
      </div>
    </div>
  );
}

// ── Result view ───────────────────────────────────────────────────────────────

function ResultView({
  result,
  onRerun,
}: {
  result: EligibilityResult;
  onRerun: () => void;
}) {
  const { totalScore, status, reasons } = result;

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
              Generated {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            id="eligibility-rerun-btn"
            className={styles.rerunBtn}
            onClick={onRerun}
          >
            <RerunIcon /> Re-run Analysis
          </button>
        </div>

        {/* ── Score banner ─────────────────────────────────────────────────── */}
        <div className={`${styles.scoreBanner} ${cfg.bannerClass}`}>
          <div className={styles.scoreBannerLeft}>
            <span className={styles.scoreLabel}>Overall Verdict</span>
            <p className={`${styles.scoreVerdict} ${cfg.verdictClass}`}>
              {status}
            </p>
            <p className={styles.scoreDescription}>{cfg.description}</p>
          </div>

          {/* Big numeric score */}
          <div className={styles.scoreCircle}>
            <span className={`${styles.scoreNumber} ${cfg.verdictClass}`}>
              {totalScore}
            </span>
            <span className={styles.scoreDenom}>/100</span>
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>Score</span>
            <span className={`${styles.scorePill} ${cfg.pillClass}`}>
              {totalScore} pts
            </span>
          </div>
          <div className={styles.progressTrack} role="progressbar" aria-valuenow={totalScore} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`${styles.progressBar} ${cfg.barClass}`}
              style={{ width: `${totalScore}%` }}
            />
          </div>
          <div className={styles.progressTicks}>
            <span>0</span>
            <span>Ineligible</span>
            <span className={styles.tickMid}>50 — Review</span>
            <span>80 — Eligible</span>
            <span>100</span>
          </div>
        </div>

        {/* ── Score breakdown ──────────────────────────────────────────────── */}
        <div className={styles.financialsSection}>
          <p className={styles.sectionLabel}>Score Breakdown</p>
          <div className={styles.reasonsTable}>
            {reasons.map((r, i) => (
              <div key={i} className={styles.reasonRow}>
                <span className={styles.reasonLabel}>{r.label}</span>
                <span
                  className={`${styles.reasonDelta} ${
                    r.delta > 0
                      ? styles.reasonDeltaPos
                      : r.delta < 0
                      ? styles.reasonDeltaNeg
                      : styles.reasonDeltaBase
                  }`}
                >
                  {r.delta > 0 ? `+${r.delta}` : r.delta === 0 ? `${r.delta}` : r.delta}
                </span>
              </div>
            ))}
            {/* Total row */}
            <div className={`${styles.reasonRow} ${styles.reasonRowTotal}`}>
              <span className={styles.reasonLabel}>
                <strong>Final Score</strong>
              </span>
              <span className={`${styles.reasonDelta} ${cfg.verdictClass}`}>
                <strong>{totalScore} / 100</strong>
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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
