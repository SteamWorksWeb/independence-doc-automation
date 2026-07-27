"use client";

/**
 * src/components/admin/EditSnapshotModal.tsx
 *
 * Slide-out modal for editing borrower info on the Discharge SnapShot view.
 * Matches the reference design: blue header bar, summary block, exhaustive form,
 * blue UPDATE button footer.
 *
 * Brand: Navy (#1a2744) headers, Blue (#1d4ed8) primary actions.
 */

import React, { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SnapshotBorrower {
  id: string;
  lastName: string;
  firstName: string;
  created: string;
  createdBy: string;
  lastUpdated: string;
  lastUpdatedBy: string;
  dischargeable: "Yes" | "Incomplete" | "No";
  lowestMonthlyPayment?: string;
}

interface FormState {
  hasFederalLoans: string;
  outstandingBalance: string;
  householdSize: string;
  monthlyGrossIncome: string;
  monthlyTakeHomePay: string;
  additionalMonthlyIncome: string;
  housingExpenses: string;
  transportationExpenses: string;
  dependentCareExpenses: string;
  currentlyEmployed: string;
  workInFieldOfStudy: string;
  unemployed5Years: string;
  hasDisability: string;
  didGraduate: string;
  schoolClosed: string;
  lastAttendedSchool: string;
  is65OrOlder: string;
}

const DEFAULT_FORM: FormState = {
  hasFederalLoans: "Yes",
  outstandingBalance: "29000.00",
  householdSize: "2",
  monthlyGrossIncome: "7200.00",
  monthlyTakeHomePay: "7200.00",
  additionalMonthlyIncome: "0.00",
  housingExpenses: "7300.00",
  transportationExpenses: "125.00",
  dependentCareExpenses: "0.00",
  currentlyEmployed: "Yes",
  workInFieldOfStudy: "Yes",
  unemployed5Years: "No",
  hasDisability: "No",
  didGraduate: "Yes",
  schoolClosed: "No",
  lastAttendedSchool: "1990-06-24",
  is65OrOlder: "Yes",
};

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelCls = "text-[0.875rem] text-[#374151] leading-snug";
const inputCls =
  "w-full border border-[#d1d5db] rounded px-3 py-2 text-[0.875rem] text-[#1a2744] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/15 transition-all duration-150 bg-white";
const selectCls =
  "w-full border border-[#d1d5db] rounded px-3 py-2 text-[0.875rem] text-[#1a2744] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/15 transition-all duration-150 bg-white appearance-none cursor-pointer";

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_220px] items-start gap-6 py-3 border-b border-[#f3f4f6] last:border-0">
      <span className={labelCls}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function CurrencyInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <div className="flex items-center border border-[#d1d5db] rounded overflow-hidden focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/15 transition-all duration-150">
      <span className="px-2.5 py-2 bg-[#f3f4f6] text-[#6b7280] text-[0.875rem] border-r border-[#d1d5db] shrink-0">
        $
      </span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 text-[0.875rem] text-[#1a2744] outline-none bg-white"
      />
    </div>
  );
}

function YesNoSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectCls}
    >
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EditSnapshotModal({
  borrower,
  onClose,
}: {
  borrower: SnapshotBorrower;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fullName = `${borrower.firstName} ${borrower.lastName}`;

  return (
    /* Overlay */
    <div
      id="edit-snapshot-overlay"
      className="fixed inset-0 z-[600] flex items-start justify-end"
      style={{ background: "rgba(17,24,39,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Edit Borrower Info"
    >
      {/* Drawer panel */}
      <div className="relative h-full w-[min(98vw,680px)] bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">

        {/* ── Header bar ── */}
        <div className="bg-[#1d4ed8] px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-white text-[1.125rem]">Edit Borrower Info</h2>
          <button
            id="edit-snapshot-close-btn"
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors duration-150 cursor-pointer p-1"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Summary block ── */}
        <div className="px-6 py-4 border-b border-[#e5e7eb] bg-white shrink-0">
          <div className="space-y-1 text-[0.875rem] text-[#374151]">
            <div><span className="font-semibold">Borrower Name:</span> {fullName}</div>
            <div><span className="font-semibold">Dischargeable?:</span> {borrower.dischargeable}</div>
            <div><span className="font-semibold">Lowest Monthly Payment:</span> {borrower.lowestMonthlyPayment ?? "$314.25"}</div>
          </div>
          <p className="text-[0.75rem] text-[#6b7280] mt-2 italic">
            * Based on information provided. Eligibility must be confirmed.
          </p>
        </div>

        {/* ── Scrollable form ── */}
        <div className="flex-1 overflow-y-auto px-6 py-2">

          <FieldRow label="Does borrower have federal student loans?">
            <YesNoSelect id="es-federal-loans" value={form.hasFederalLoans} onChange={set("hasFederalLoans")} />
          </FieldRow>

          <FieldRow label="What is the outstanding principal balance on the student loans?">
            <CurrencyInput id="es-balance" value={form.outstandingBalance} onChange={set("outstandingBalance")} />
          </FieldRow>

          <FieldRow label="How many people are in borrower's household?">
            <select
              id="es-household-size"
              value={form.householdSize}
              onChange={(e) => set("householdSize")(e.target.value)}
              className={selectCls}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="What is borrower's monthly gross income?">
            <CurrencyInput id="es-gross-income" value={form.monthlyGrossIncome} onChange={set("monthlyGrossIncome")} />
          </FieldRow>

          <FieldRow label="What is borrower's monthly take-home pay?">
            <CurrencyInput id="es-take-home" value={form.monthlyTakeHomePay} onChange={set("monthlyTakeHomePay")} />
          </FieldRow>

          <FieldRow label="Enter any additional monthly income from anyone in borrower's household.">
            <CurrencyInput id="es-additional-income" value={form.additionalMonthlyIncome} onChange={set("additionalMonthlyIncome")} />
          </FieldRow>

          <FieldRow label="What are borrower's monthly housing expenses?">
            <CurrencyInput id="es-housing" value={form.housingExpenses} onChange={set("housingExpenses")} />
          </FieldRow>

          <FieldRow label="What are borrower's monthly transportation expenses?">
            <CurrencyInput id="es-transportation" value={form.transportationExpenses} onChange={set("transportationExpenses")} />
          </FieldRow>

          <FieldRow label="Enter any monthly family and dependent care expenses borrower has.">
            <CurrencyInput id="es-dependent-care" value={form.dependentCareExpenses} onChange={set("dependentCareExpenses")} />
          </FieldRow>

          <FieldRow label="Is the borrower currently employed?">
            <YesNoSelect id="es-employed" value={form.currentlyEmployed} onChange={set("currentlyEmployed")} />
          </FieldRow>

          <FieldRow label="Does borrower work in a field for which they went to school?">
            <YesNoSelect id="es-field-of-study" value={form.workInFieldOfStudy} onChange={set("workInFieldOfStudy")} />
          </FieldRow>

          <FieldRow label="Has borrower been unemployed for 5 or more years in the last 10?">
            <YesNoSelect id="es-unemployed" value={form.unemployed5Years} onChange={set("unemployed5Years")} />
          </FieldRow>

          <FieldRow label="Does borrower have a disability or chronic injury which limits borrower's ability to work?">
            <YesNoSelect id="es-disability" value={form.hasDisability} onChange={set("hasDisability")} />
          </FieldRow>

          <FieldRow label="Did borrower graduate?">
            <YesNoSelect id="es-graduated" value={form.didGraduate} onChange={set("didGraduate")} />
          </FieldRow>

          <FieldRow label="Is borrower's school now closed?">
            <YesNoSelect id="es-school-closed" value={form.schoolClosed} onChange={set("schoolClosed")} />
          </FieldRow>

          <FieldRow label="When did borrower last attend school?">
            <input
              id="es-last-attended"
              type="date"
              value={form.lastAttendedSchool}
              onChange={(e) => set("lastAttendedSchool")(e.target.value)}
              className={inputCls}
            />
          </FieldRow>

          <FieldRow label="Is borrower 65 or older?">
            <YesNoSelect id="es-65-or-older" value={form.is65OrOlder} onChange={set("is65OrOlder")} />
          </FieldRow>

        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-[#e5e7eb] bg-white shrink-0 flex justify-center">
          <button
            id="edit-snapshot-update-btn"
            className="px-16 py-3 bg-[#1d4ed8] text-white font-bold text-[0.9375rem] tracking-widest uppercase rounded hover:bg-[#1e40af] transition-colors duration-150 cursor-pointer shadow-md"
          >
            UPDATE
          </button>
        </div>

      </div>
    </div>
  );
}
