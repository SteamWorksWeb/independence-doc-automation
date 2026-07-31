"use client";

/**
 * src/components/admin/AdminFinancialScoreboard.tsx
 *
 * ADMIN-ONLY — NEVER import this from any client-facing page
 * (/apply, client dashboard, or portal routes).
 * It is strictly for internal staff evaluation.
 *
 * Real-time financial scoreboard: Total Income - Total Expenses = Disposable Income
 *
 * Colour logic (bankruptcy dischargeability heuristic):
 *   Disposable Income <= 0  ?  GREEN  "Good Candidate"  (no surplus to service debt)
 *   Disposable Income  > 0  ?  RED    "Review Required" (surplus may bar discharge)
 */

import React, { useMemo } from "react";

// -- Prop shape -----------------------------------------------------------------

export interface AdminFinancialScoreboardProps {
  /** Primary wage / salary income */
  monthlyGrossIncome?: string;
  /**
   * Take-home (after-tax) pay — used as the baseline income figure when
   * present; falls back to monthlyGrossIncome if blank.
   */
  monthlyTakeHomePay?: string;
  /** Any additional household income */
  additionalMonthlyIncome?: string;
  /** Housing cost (rent / mortgage) */
  housingExpenses?: string;
  /** Transportation (fuel, transit, insurance, etc.) */
  transportationExpenses?: string;
  /** Child-care, elder-care, or other dependent costs */
  dependentCareExpenses?: string;
  /**
   * "sticky-top" = sticky banner at top of container (default for modals/forms).
   * "floating"   = fixed bottom-right floating widget.
   */
  variant?: "sticky-top" | "floating";
}

// -- Helpers --------------------------------------------------------------------

/** Parse a raw string (possibly with "$", ",", spaces) to a finite number. */
function parseCurrency(raw?: string): number {
  if (!raw || raw.trim() === "") return 0;
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

function fmt(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

// -- Sub-components -------------------------------------------------------------

function MetricPill({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.8125rem] whitespace-nowrap"
      style={{ background: bg, color }}
    >
      <span className="text-[0.6875rem] opacity-60 uppercase tracking-wide">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function MathOp({ symbol }: { symbol: string }) {
  return (
    <span className="text-[#9ca3af] text-[0.875rem] font-bold select-none">{symbol}</span>
  );
}

function ScoreboardIcon({ color }: { color: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function VerdictIcon({ isGood, color }: { isGood: boolean; color: string }) {
  if (isGood) {
    return (
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function MathRows({
  totalIncome,
  totalExpenses,
  disposable,
  isGoodCandidate,
  accentColor,
}: {
  totalIncome: number;
  totalExpenses: number;
  disposable: number;
  isGoodCandidate: boolean;
  accentColor: string;
}) {
  const rowStyle = "flex justify-between text-[0.8125rem] gap-4";
  return (
    <div className="space-y-1.5">
      <div className={rowStyle}>
        <span className="text-[#6b7280]">Total Income</span>
        <span className="font-semibold text-[#1a2744]">{fmt(totalIncome)}</span>
      </div>
      <div className={rowStyle}>
        <span className="text-[#6b7280]">Total Expenses</span>
        <span className="font-semibold text-[#1a2744]">- {fmt(totalExpenses)}</span>
      </div>
      <div
        className="flex justify-between items-center pt-1.5 border-t text-[0.875rem] font-bold"
        style={{ borderColor: accentColor + "33" }}
      >
        <span style={{ color: accentColor }}>Disposable Income</span>
        <span style={{ color: accentColor }}>{fmt(disposable)}</span>
      </div>
      <div
        className="mt-1 text-center text-[0.625rem] font-bold uppercase tracking-widest"
        style={{ color: accentColor }}
      >
        {isGoodCandidate ? "? Good Candidate" : "? Review Required"}
      </div>
    </div>
  );
}

// -- Main Component -------------------------------------------------------------

export default function AdminFinancialScoreboard({
  monthlyGrossIncome,
  monthlyTakeHomePay,
  additionalMonthlyIncome,
  housingExpenses,
  transportationExpenses,
  dependentCareExpenses,
  variant = "sticky-top",
}: AdminFinancialScoreboardProps) {
  const { totalIncome, totalExpenses, disposable, isGoodCandidate } =
    useMemo(() => {
      const baseIncome =
        parseCurrency(monthlyTakeHomePay) || parseCurrency(monthlyGrossIncome);
      const additional = parseCurrency(additionalMonthlyIncome);
      const totalIncome = baseIncome + additional;

      const housing = parseCurrency(housingExpenses);
      const transport = parseCurrency(transportationExpenses);
      const dependents = parseCurrency(dependentCareExpenses);
      const totalExpenses = housing + transport + dependents;

      const disposable = totalIncome - totalExpenses;
      const isGoodCandidate = disposable <= 0;

      return { totalIncome, totalExpenses, disposable, isGoodCandidate };
    }, [
      monthlyGrossIncome,
      monthlyTakeHomePay,
      additionalMonthlyIncome,
      housingExpenses,
      transportationExpenses,
      dependentCareExpenses,
    ]);

  const accentColor  = isGoodCandidate ? "#16a34a" : "#dc2626";
  const accentBg     = isGoodCandidate ? "#f0fdf4" : "#fff1f2";
  const accentBorder = isGoodCandidate ? "#bbf7d0" : "#fecaca";
  const accentBgMuted = isGoodCandidate ? "#dcfce7" : "#fee2e2";

  // -- Floating variant -------------------------------------------------------

  if (variant === "floating") {
    return (
      <div
        id="admin-financial-scoreboard-floating"
        aria-label="Admin Financial Scoreboard"
        role="status"
        className="fixed bottom-6 right-6 z-[200] max-w-[280px] w-full"
        style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18))" }}
      >
        <div
          className="rounded-xl border p-4 backdrop-blur-sm"
          style={{ background: accentBg, borderColor: accentBorder }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: accentBgMuted }}
            >
              <ScoreboardIcon color={accentColor} />
            </span>
            <span
              className="text-[0.6875rem] font-bold uppercase tracking-widest"
              style={{ color: accentColor }}
            >
              Admin Scoreboard
            </span>
          </div>
          <MathRows
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            disposable={disposable}
            isGoodCandidate={isGoodCandidate}
            accentColor={accentColor}
          />
        </div>
      </div>
    );
  }

  // -- Sticky-top banner (default) --------------------------------------------

  return (
    <div
      id="admin-financial-scoreboard"
      aria-label="Admin Financial Scoreboard"
      role="status"
      className="sticky top-0 z-[50] w-full"
    >
      <div
        className="border-b px-4 py-2.5"
        style={{ background: accentBg, borderColor: accentBorder }}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">

          {/* Label */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: accentBgMuted }}
            >
              <ScoreboardIcon color={accentColor} />
            </span>
            <span
              className="text-[0.6875rem] font-bold uppercase tracking-widest whitespace-nowrap"
              style={{ color: accentColor }}
            >
              Staff Scoreboard
            </span>
            <span
              className="text-[0.625rem] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
              style={{ background: accentBgMuted, color: accentColor }}
            >
              Admin only
            </span>
          </div>

          {/* Divider */}
          <div
            className="hidden sm:block h-5 w-px shrink-0 opacity-40"
            style={{ background: accentColor }}
          />

          {/* Math strip */}
          <div className="flex items-center gap-2 flex-wrap">
            <MetricPill label="Income"   value={fmt(totalIncome)}   color="#374151" bg="#f3f4f6" />
            <MathOp symbol="-" />
            <MetricPill label="Expenses" value={fmt(totalExpenses)} color="#374151" bg="#f3f4f6" />
            <MathOp symbol="=" />

            {/* Disposable result */}
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold text-[0.875rem] whitespace-nowrap"
              style={{ background: accentBgMuted, borderColor: accentBorder, color: accentColor }}
            >
              <span className="text-[0.6875rem] font-semibold opacity-75 uppercase tracking-wide">Disposable</span>
              <span>{fmt(disposable)}</span>
            </div>

            {/* Verdict badge */}
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wide whitespace-nowrap border"
              style={{ background: accentBgMuted, borderColor: accentBorder, color: accentColor }}
            >
              <VerdictIcon isGood={isGoodCandidate} color={accentColor} />
              {isGoodCandidate ? "Good Candidate" : "Review Required"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
