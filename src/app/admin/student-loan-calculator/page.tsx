"use client";

/**
 * src/app/admin/student-loan-calculator/page.tsx
 *
 * Student Loan Repayment & Settlement Analyzer
 *
 * A real-time calculator for legal professionals advising distressed borrowers.
 * Computes income-driven repayment plans (SAVE, IBR) and a private settlement
 * target alongside the standard 10-year amortized payment — all client-side
 * with zero network round-trips.
 *
 * Math Reference
 * ──────────────
 *  Poverty Line Base  = $15,000 + ((Family Size - 1) * $5,000)
 *  Standard 10-Year   = (B × r) / (1 − (1 + r)^−120)   where r = Rate / 1200
 *  SAVE  (10%)        = max(0, (AGI − PL × 2.25) × 0.10 / 12)
 *  IBR   (15%)        = max(0, (AGI − PL × 1.50) × 0.15 / 12)
 *  Settlement Target  = Balance × 0.60
 */

import { useMemo, useState, useId } from "react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function povertyBase(familySize: number): number {
  return 15_000 + (familySize - 1) * 5_000;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Results {
  standard: number;
  save: number;
  ibr: number;
  settlement: number;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InputField({
  id,
  label,
  hint,
  value,
  min,
  step,
  onChange,
  prefix,
  suffix,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[0.8125rem] font-semibold text-[#374151] tracking-wide"
      >
        {label}
      </label>
      <p className="text-[0.75rem] text-[#6b7280] leading-snug -mt-0.5">{hint}</p>
      <div className="flex items-center border border-[#d1d5db] rounded-lg overflow-hidden shadow-sm focus-within:border-[#1e3a5f] focus-within:ring-2 focus-within:ring-[#1e3a5f]/10 transition-all duration-150 bg-white">
        {prefix && (
          <span className="px-3 py-2.5 text-[0.875rem] text-[#6b7280] bg-[#f9fafb] border-r border-[#d1d5db] select-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          min={min ?? 0}
          step={step ?? 1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 px-3 py-2.5 text-[0.9375rem] text-[#111827] bg-transparent outline-none min-w-0 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="px-3 py-2.5 text-[0.875rem] text-[#6b7280] bg-[#f9fafb] border-l border-[#d1d5db] select-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

interface ResultCardProps {
  title: string;
  subtitle: string;
  value: string;
  isLowest?: boolean;
  isSettlement?: boolean;
  icon: React.ReactNode;
}

function ResultCard({
  title,
  subtitle,
  value,
  isLowest,
  isSettlement,
  icon,
}: ResultCardProps) {
  return (
    <div
      className={`relative flex flex-col gap-3 rounded-xl border p-5 shadow-sm transition-all duration-200 ${
        isSettlement
          ? "border-[#dde2ea] bg-[#fafbfc]"
          : isLowest
          ? "border-[#16a34a] bg-[#f0fdf4] shadow-[0_0_0_3px_rgba(22,163,74,0.12)]"
          : "border-[#dde2ea] bg-white"
      }`}
    >
      {/* Lowest badge */}
      {isLowest && (
        <span className="absolute -top-3 left-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#16a34a] text-white text-[0.6875rem] font-bold tracking-wide shadow-sm">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          LOWEST PAYMENT
        </span>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[0.8125rem] font-bold text-[#374151] tracking-wide uppercase">
            {title}
          </p>
          <p className="text-[0.75rem] text-[#6b7280] mt-0.5">{subtitle}</p>
        </div>
        <span
          className={`mt-0.5 shrink-0 ${
            isSettlement
              ? "text-[#b31e3c]"
              : isLowest
              ? "text-[#16a34a]"
              : "text-[#1e3a5f]"
          }`}
        >
          {icon}
        </span>
      </div>

      {/* Value */}
      <p
        className={`font-serif text-[1.75rem] font-bold leading-none tracking-tight ${
          isSettlement
            ? "text-[#b31e3c]"
            : isLowest
            ? "text-[#16a34a]"
            : "text-[#1e3a5f]"
        }`}
      >
        {value}
      </p>

      {/* Per-period label */}
      <p className="text-[0.75rem] text-[#9ca3af]">
        {isSettlement ? "one-time lump sum" : "per month"}
      </p>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function CalcIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10" strokeWidth="2.5" /><line x1="12" y1="10" x2="12" y2="10" strokeWidth="2.5" /><line x1="16" y1="10" x2="16" y2="10" strokeWidth="2.5" />
      <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5" /><line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5" /><line x1="16" y1="14" x2="16" y2="18" strokeWidth="2.5" />
      <line x1="8" y1="18" x2="8" y2="18" strokeWidth="2.5" /><line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function InfoSmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function StudentLoanCalculatorPage() {
  const uid = useId();

  const [balance, setBalance] = useState(50_000);
  const [rate, setRate] = useState(6.5);
  const [agi, setAgi] = useState(45_000);
  const [familySize, setFamilySize] = useState(1);

  const results = useMemo<Results>(() => {
    const r = rate / 1200; // monthly rate
    const pl = povertyBase(familySize);

    // Standard 10-year amortization (guard rate = 0)
    const standard =
      r === 0
        ? balance / 120
        : (balance * r) / (1 - Math.pow(1 + r, -120));

    // SAVE plan — 10% of discretionary above 225% poverty line
    const save = Math.max(0, ((agi - pl * 2.25) * 0.1) / 12);

    // IBR plan — 15% of discretionary above 150% poverty line
    const ibr = Math.max(0, ((agi - pl * 1.5) * 0.15) / 12);

    // Private / default settlement — 60% lump sum
    const settlement = balance * 0.6;

    return { standard, save, ibr, settlement };
  }, [balance, rate, agi, familySize]);

  // Determine which monthly plan is lowest
  const lowestKey = useMemo<"standard" | "save" | "ibr">(() => {
    const { standard, save, ibr } = results;
    if (save <= ibr && save <= standard) return "save";
    if (ibr <= standard) return "ibr";
    return "standard";
  }, [results]);

  const pl = povertyBase(familySize);

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Page Header ────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-[1.5rem] font-bold text-[#1e3a5f] leading-tight">
              Student Loan &amp; Settlement Analyzer
            </h1>
            <p className="text-[0.875rem] text-[#6b7280] mt-1 max-w-[540px]">
              Real-time repayment &amp; settlement projections for distressed
              borrowers. Adjust the inputs below to see results instantly.
            </p>
          </div>
          <span className="text-[#1e3a5f] opacity-60 mt-1">
            <CalcIcon />
          </span>
        </div>

        {/* ── Input Panel ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#dde2ea] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#dde2ea] bg-[#fafbfc] flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#1e3a5f]" />
            <h2 className="text-[0.8125rem] font-bold tracking-[0.06em] uppercase text-[#374151]">
              Borrower Inputs
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 p-6">
            <InputField
              id={`${uid}-balance`}
              label="Loan Balance"
              hint="Total outstanding principal"
              value={balance}
              step={1000}
              prefix="$"
              onChange={(v) => setBalance(Math.max(0, v))}
            />
            <InputField
              id={`${uid}-rate`}
              label="Interest Rate"
              hint="Annual interest rate on the loan"
              value={rate}
              step={0.1}
              min={0}
              suffix="%"
              onChange={(v) => setRate(Math.max(0, v))}
            />
            <InputField
              id={`${uid}-agi`}
              label="Adjusted Gross Income"
              hint="Borrower's annual AGI from tax return"
              value={agi}
              step={500}
              prefix="$"
              onChange={(v) => setAgi(Math.max(0, v))}
            />
            <InputField
              id={`${uid}-family`}
              label="Family Size"
              hint="Number of people in borrower's household"
              value={familySize}
              min={1}
              step={1}
              onChange={(v) => setFamilySize(Math.max(1, Math.round(v)))}
            />
          </div>

          {/* Poverty line callout */}
          <div className="mx-6 mb-6 flex items-center gap-2 text-[0.75rem] text-[#6b7280] bg-[#f4f6f9] rounded-lg px-4 py-2.5 border border-[#e5e7eb]">
            <span className="text-[#1e3a5f] shrink-0"><InfoSmIcon /></span>
            <span>
              Federal Poverty Line for family of&nbsp;
              <strong className="text-[#374151]">{familySize}</strong>:&nbsp;
              <strong className="text-[#374151]">{usd(pl)}</strong>&nbsp;·&nbsp;
              225% threshold (SAVE):&nbsp;<strong className="text-[#374151]">{usd(pl * 2.25)}</strong>&nbsp;·&nbsp;
              150% threshold (IBR):&nbsp;<strong className="text-[#374151]">{usd(pl * 1.5)}</strong>
            </span>
          </div>
        </div>

        {/* ── Results Grid ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-[#b31e3c]" />
            <h2 className="text-[0.8125rem] font-bold tracking-[0.06em] uppercase text-[#374151]">
              Payment Projections
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <ResultCard
              title="Standard 10-Year"
              subtitle="Fixed amortized payment"
              value={usd(results.standard)}
              isLowest={lowestKey === "standard"}
              icon={<TrendIcon />}
            />
            <ResultCard
              title="SAVE Plan"
              subtitle="10% discretionary · 225% poverty"
              value={usd(results.save)}
              isLowest={lowestKey === "save"}
              icon={<ShieldIcon />}
            />
            <ResultCard
              title="IBR Plan"
              subtitle="15% discretionary · 150% poverty"
              value={usd(results.ibr)}
              isLowest={lowestKey === "ibr"}
              icon={<ShieldIcon />}
            />
            <ResultCard
              title="Settlement Target"
              subtitle="Private / default lump sum"
              value={usd(results.settlement)}
              isSettlement
              icon={<TargetIcon />}
            />
          </div>
        </div>

        {/* ── Comparison Table ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#dde2ea] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#dde2ea] bg-[#fafbfc] flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#b31e3c]" />
            <h2 className="text-[0.8125rem] font-bold tracking-[0.06em] uppercase text-[#374151]">
              Side-by-Side Comparison
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[540px]">
              <thead>
                <tr>
                  {["Plan", "Monthly Payment", "Annual Cost", "10-Year Total", "vs. Standard"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`py-3 px-5 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-[#6b7280] bg-[#f9fafb] border-b border-[#dde2ea] ${
                          i === 0 ? "pl-6" : ""
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    {
                      key: "standard" as const,
                      plan: "Standard 10-Year",
                      monthly: results.standard,
                    },
                    {
                      key: "save" as const,
                      plan: "SAVE (10%)",
                      monthly: results.save,
                    },
                    {
                      key: "ibr" as const,
                      plan: "IBR (15%)",
                      monthly: results.ibr,
                    },
                  ] as { key: "standard" | "save" | "ibr"; plan: string; monthly: number }[]
                ).map(({ key, plan, monthly }) => {
                  const isLow = lowestKey === key;
                  const diff = monthly - results.standard;
                  return (
                    <tr
                      key={key}
                      className={`border-b border-[#f0f2f5] transition-colors ${
                        isLow ? "bg-[#f0fdf4]" : "hover:bg-[#fafbfc]"
                      }`}
                    >
                      <td className="pl-6 pr-5 py-3.5 font-semibold text-[#1e3a5f] whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {plan}
                          {isLow && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#16a34a] text-white text-[0.625rem] font-bold tracking-wide">
                              LOWEST
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 font-bold tabular-nums ${isLow ? "text-[#16a34a]" : "text-[#111827]"}`}>
                        {usd(monthly)}
                      </td>
                      <td className="px-5 py-3.5 text-[#374151] tabular-nums">
                        {usd(monthly * 12)}
                      </td>
                      <td className="px-5 py-3.5 text-[#374151] tabular-nums">
                        {usd(monthly * 120)}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums">
                        {key === "standard" ? (
                          <span className="text-[#9ca3af]">—</span>
                        ) : diff < 0 ? (
                          <span className="text-[#16a34a] font-semibold">
                            −{usd(Math.abs(diff))}/mo
                          </span>
                        ) : (
                          <span className="text-[#b31e3c] font-semibold">
                            +{usd(diff)}/mo
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Settlement footer row */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#fff5f6] border-t border-[#fecdd3]">
            <div>
              <p className="text-[0.8125rem] font-bold text-[#b31e3c]">
                Private / Default Settlement Target
              </p>
              <p className="text-[0.75rem] text-[#9ca3af] mt-0.5">
                60% of current balance — one-time lump sum
              </p>
            </div>
            <p className="font-serif text-[1.25rem] font-bold text-[#b31e3c] tabular-nums">
              {usd(results.settlement)}
            </p>
          </div>
        </div>

        {/* ── Disclaimer ──────────────────────────────────────────────────── */}
        <p className="text-[0.7375rem] text-[#9ca3af] text-center leading-relaxed pb-2">
          This tool is for internal attorney use only. Results are estimates
          based on simplified federal formulas and do not constitute legal or
          financial advice. Actual IDR payments depend on loan servicer
          recertification, prior payments, and regulatory changes.
        </p>
      </div>
    </div>
  );
}
