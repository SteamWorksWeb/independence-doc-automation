"use client";

/**
 * src/app/admin/discharge-snapshots/new/page.tsx
 *
 * Multi-step onboarding wizard for creating a new Discharge SnapShot.
 * Route: /admin/discharge-snapshots/new
 *
 * Steps:
 *   1 — Client Setup       (First Name, Last Name, Email, Phone)
 *   2 — Federal Loans      (block buttons: Yes / No / I don't know + warning modal)
 *   3 — Balance & Household ($ balance input + household size dropdown)
 *   4 — Monthly Income     (Gross Income + Take-Home Pay)
 *   5 — Monthly Expenses   (Additional income, Housing, Transportation, Dependent care)
 *   6 — Employment & Health (4 × Yes/No dropdowns)
 *   7 — Education & Age    (3 × Yes/No + date + Yes/No)
 *
 * On final step "Submit Discharge Snapshot":
 *   - POSTs to the Next.js proxy  POST /api/admin/discharge-snapshots
 *   - Proxy forwards to backend   POST /api/v1/admin/discharge-snapshots
 *   - 201 success  → router.push + router.refresh to list page
 *   - Non-201      → inline error banner shown to the user
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

const STEP_LABELS: Record<number, string> = {
  1: "Client Setup",
  2: "Student Loans Owed",
  3: "Outstanding Balance",
  4: "Monthly Income",
  5: "Monthly Expenses",
  6: "Employment & Health",
  7: "Education & Age",
};

// ── Form state ────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  // Step 2
  hasFederalLoans: string;
  // Step 3
  outstandingBalance: string;
  householdSize: string;
  // Step 4
  monthlyGrossIncome: string;
  monthlyTakeHomePay: string;
  // Step 5
  additionalMonthlyIncome: string;
  housingExpenses: string;
  transportationExpenses: string;
  dependentCareExpenses: string;
  // Step 6
  currentlyEmployed: string;
  workInFieldOfStudy: string;
  unemployed5Years: string;
  hasDisability: string;
  // Step 7
  didGraduate: string;
  schoolClosed: string;
  lastAttendedSchool: string;
  is65OrOlder: string;
}

const INITIAL_FORM: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  hasFederalLoans: "",
  outstandingBalance: "",
  householdSize: "1",
  monthlyGrossIncome: "",
  monthlyTakeHomePay: "",
  additionalMonthlyIncome: "",
  housingExpenses: "",
  transportationExpenses: "",
  dependentCareExpenses: "",
  currentlyEmployed: "Yes",
  workInFieldOfStudy: "Yes",
  unemployed5Years: "No",
  hasDisability: "No",
  didGraduate: "Yes",
  schoolClosed: "No",
  lastAttendedSchool: "",
  is65OrOlder: "No",
};

// ── Shared field styles ───────────────────────────────────────────────────────

const inputCls =
  "w-full px-5 py-4 text-[0.9375rem] text-[#1a2744] outline-none bg-transparent placeholder:text-transparent";

const selectRowCls =
  "w-36 border border-[#d1d5db] rounded px-3 py-2.5 text-[0.875rem] text-[#1a2744] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/12 bg-white cursor-pointer appearance-none shrink-0";

// ── Sub-components ────────────────────────────────────────────────────────────

/** Input with visually overlaid label + required asterisk (hides when value present) */
function WizardInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="relative border border-[#d1d5db] rounded bg-white hover:border-[#9ca3af] focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/12 transition-all duration-150">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        className={inputCls}
        autoComplete="off"
      />
      {/* Overlay label — visible only when field is empty */}
      {!value && (
        <div className="absolute inset-0 flex items-center px-5 pointer-events-none select-none">
          <span className="text-[#9ca3af] text-[0.9375rem]">
            {label}
            {required && <span className="text-[#b31e3c] ml-0.5">*</span>}
          </span>
        </div>
      )}
    </div>
  );
}

/** Currency input with $ prefix */
function CurrencyWizardInput({
  id,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center border border-[#d1d5db] rounded bg-white hover:border-[#9ca3af] focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/12 transition-all duration-150 overflow-hidden">
      <span className="px-3 py-3.5 text-[#9ca3af] border-r border-[#d1d5db] bg-[#f9fafb] text-[0.9375rem] shrink-0">
        $
      </span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-3.5 text-[0.9375rem] text-[#1a2744] outline-none bg-transparent placeholder:text-[#9ca3af]"
      />
    </div>
  );
}

/** Yes/No select row */
function YesNoRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-8 py-3 border-b border-[#f3f4f6] last:border-0">
      <label htmlFor={id} className="text-[0.9375rem] text-[#374151] leading-snug flex-1 pt-0.5 cursor-pointer">
        {label}
      </label>
      <div className="relative shrink-0">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectRowCls}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">
          <ChevronDownSm />
        </span>
      </div>
    </div>
  );
}

/** Primary action button (blue) */
function PrimaryBtn({
  id,
  label,
  onClick,
}: {
  id: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="px-8 py-3.5 bg-[#1d4ed8] text-white font-semibold text-[0.9375rem] rounded hover:bg-[#1e40af] transition-colors duration-150 cursor-pointer shadow-sm"
    >
      {label}
    </button>
  );
}

/** Continue button (crimson, full-width up to max) */
function ContinueBtn({ id, onClick, label = "CONTINUE" }: { id: string; onClick: () => void; label?: string }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="w-full max-w-md py-4 bg-[#b31e3c] text-white font-bold text-[0.9375rem] tracking-widest uppercase rounded hover:bg-[#9b1a33] transition-colors duration-150 cursor-pointer shadow-sm"
    >
      {label}
    </button>
  );
}

// ── Main wizard component ─────────────────────────────────────────────────────

export default function NewDischargeSnapshotPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showWarning, setShowWarning] = useState(false);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (key: keyof FormData) => (value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const nextStep = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const progressPct = Math.round((step / TOTAL_STEPS) * 100);

  function handleFederalLoans(answer: string) {
    set("hasFederalLoans")(answer);
    if (answer === "No" || answer === "I don't know") {
      setShowWarning(true);
    } else {
      nextStep();
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/admin/discharge-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Credentials not required for same-origin proxy calls, but kept for
        // safety so cookies (including admin_session) are always forwarded.
        credentials: "same-origin",
        body: JSON.stringify(formData),
      });

      if (res.status === 201) {
        // Success — navigate back to the list and bust the RSC cache
        router.push("/admin/discharge-snapshots");
        router.refresh();
        return;
      }

      // Non-201: surface the backend error message if available
      let errMsg = `Submission failed (HTTP ${res.status}). Please try again.`;
      try {
        const errBody = await res.json();
        if (res.status === 409) {
          // Duplicate email — give a clear, actionable message
          errMsg =
            errBody?.message ||
            `A borrower with the email "${formData.email}" already exists. ` +
              `Please use a different email address or manage the existing client record.`;
        } else if (errBody?.message) {
          errMsg = errBody.message;
        }
      } catch {
        // ignore JSON parse errors on error responses
        if (res.status === 409) {
          errMsg =
            `A borrower with the email "${formData.email}" already exists. ` +
            `Please use a different email address or manage the existing client record.`;
        }
      }
      setSubmitError(errMsg);
    } catch (networkErr) {
      console.error("[wizard/handleSubmit] Network error:", networkErr);
      setSubmitError("Network error — please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-[700px] mx-auto px-2">

      {/* ── Progress bar (steps 2–7) ───────────────────────────────────── */}
      {step > 1 && (
        <div className="mb-10">
          {/* Bar */}
          <div className="h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#b31e3c] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {/* Back link */}
          <div className="mt-3">
            <button
              onClick={prevStep}
              className="text-[#b31e3c] text-[0.875rem] flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <span aria-hidden>←</span>
              <span>{STEP_LABELS[step - 1]}</span>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════ STEP 1: Client Setup ════════════════════ */}
      {step === 1 && (
        <section aria-labelledby="step1-heading">
          <h1
            id="step1-heading"
            className="text-[1.625rem] font-bold text-[#1d4ed8] mb-2"
          >
            Client Setup — Discharge Snapshot
          </h1>
          <p className="text-[0.9375rem] text-[#6b7280] mb-8">
            Complete the client information below.
          </p>

          <div className="space-y-4">
            <WizardInput
              id="wizard-first-name"
              label="Borrower First Name"
              value={formData.firstName}
              onChange={set("firstName")}
            />
            <WizardInput
              id="wizard-last-name"
              label="Borrower Last Name"
              value={formData.lastName}
              onChange={set("lastName")}
            />
            <WizardInput
              id="wizard-email"
              label="Borrower Email"
              value={formData.email}
              onChange={set("email")}
              type="email"
            />
            <WizardInput
              id="wizard-phone"
              label="Borrower Phone"
              value={formData.phone}
              onChange={set("phone")}
              type="tel"
            />
          </div>

          <div className="mt-8">
            <PrimaryBtn id="wizard-step1-continue" label="Save and Continue" onClick={nextStep} />
          </div>
        </section>
      )}

      {/* ════════════════════ STEP 2: Federal Loans ════════════════════ */}
      {step === 2 && (
        <section aria-labelledby="step2-heading">
          <h2
            id="step2-heading"
            className="text-[1.75rem] font-bold text-[#1a2744] mb-10 leading-tight"
          >
            Does borrower have federal student loans?
          </h2>

          <div className="space-y-3 max-w-[480px]">
            {(["Yes", "No", "I don't know"] as const).map((option) => (
              <button
                key={option}
                id={`wizard-loans-${option.toLowerCase().replace(/[\s']/g, "-")}`}
                onClick={() => handleFederalLoans(option)}
                className="w-full py-5 bg-[#1a2744] text-white text-[1rem] font-medium rounded-md hover:bg-[#2d3d6b] active:scale-[0.99] transition-all duration-150 cursor-pointer"
              >
                {option}
              </button>
            ))}
          </div>

          {/* Helper note */}
          <div className="mt-8 max-w-[480px] border border-[#e5e7eb] rounded-lg p-5 text-center bg-[#fafafa]">
            <p className="text-[0.875rem] text-[#6b7280] italic leading-relaxed">
              Most student loans are federal but if you&apos;re unsure, login to{" "}
              <a
                href="https://studentaid.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1d4ed8] not-italic hover:underline"
              >
                studentaid.gov
              </a>
              . If you see your loans listed on this site, these loans are federal.
              If the loans are not listed on this site, they are private.
            </p>
          </div>
        </section>
      )}

      {/* ════════════════════ STEP 3: Balance & Household ════════════════════ */}
      {step === 3 && (
        <section aria-labelledby="step3-heading">
          <h2
            id="step3-heading"
            className="text-[1.75rem] font-bold text-[#1a2744] mb-10 leading-tight"
          >
            What is the outstanding balance on the student loans?
          </h2>

          <div className="space-y-4 max-w-[480px]">
            <CurrencyWizardInput
              id="wizard-outstanding-balance"
              placeholder="Outstanding Principal Balance"
              value={formData.outstandingBalance}
              onChange={set("outstandingBalance")}
            />

            {/* Household size */}
            <div className="relative border border-[#d1d5db] rounded bg-white hover:border-[#9ca3af] focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/12 transition-all duration-150 overflow-hidden flex items-center">
              <span className="px-4 py-3.5 text-[#6b7280] text-[0.875rem] whitespace-nowrap border-r border-[#d1d5db] bg-[#f9fafb] shrink-0">
                Household size
              </span>
              <select
                id="wizard-household-size"
                value={formData.householdSize}
                onChange={(e) => set("householdSize")(e.target.value)}
                className="flex-1 px-4 py-3.5 text-[0.9375rem] text-[#1a2744] outline-none bg-transparent cursor-pointer appearance-none"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
                <option value="10+">10+</option>
              </select>
              <span className="pr-3 pointer-events-none text-[#9ca3af] shrink-0">
                <ChevronDownSm />
              </span>
            </div>
          </div>

          {/* Hint */}
          <div className="mt-6 max-w-[480px] border border-[#e5e7eb] rounded-lg p-4 text-center bg-[#fafafa]">
            <p className="text-[0.875rem] text-[#6b7280] italic">
              Estimate your balance as best you can.
            </p>
          </div>

          <div className="mt-7 max-w-[480px]">
            <ContinueBtn id="wizard-step3-continue" onClick={nextStep} />
          </div>
        </section>
      )}

      {/* ════════════════════ STEP 4: Monthly Income ════════════════════ */}
      {step === 4 && (
        <section aria-labelledby="step4-heading">
          <h2
            id="step4-heading"
            className="text-[1.75rem] font-bold text-[#1a2744] mb-10 leading-tight"
          >
            What is borrower&apos;s monthly gross income and take-home pay?
          </h2>

          <div className="space-y-4 max-w-[480px]">
            <CurrencyWizardInput
              id="wizard-gross-income"
              placeholder="Monthly Gross Income"
              value={formData.monthlyGrossIncome}
              onChange={set("monthlyGrossIncome")}
            />
            <CurrencyWizardInput
              id="wizard-take-home-pay"
              placeholder="Monthly Take-Home Pay"
              value={formData.monthlyTakeHomePay}
              onChange={set("monthlyTakeHomePay")}
            />
          </div>

          <div className="mt-8 max-w-[480px]">
            <ContinueBtn id="wizard-step4-continue" onClick={nextStep} />
          </div>
        </section>
      )}

      {/* ════════════════════ STEP 5: Expenses ════════════════════ */}
      {step === 5 && (
        <section aria-labelledby="step5-heading">
          <h2
            id="step5-heading"
            className="text-[1.75rem] font-bold text-[#1a2744] mb-10 leading-tight"
          >
            Monthly Expenses
          </h2>

          <div className="space-y-4 max-w-[480px]">
            <CurrencyWizardInput
              id="wizard-additional-income"
              placeholder="Additional Monthly Income (household)"
              value={formData.additionalMonthlyIncome}
              onChange={set("additionalMonthlyIncome")}
            />
            <CurrencyWizardInput
              id="wizard-housing-expenses"
              placeholder="Monthly Housing Expenses"
              value={formData.housingExpenses}
              onChange={set("housingExpenses")}
            />
            <CurrencyWizardInput
              id="wizard-transportation-expenses"
              placeholder="Transportation Expenses"
              value={formData.transportationExpenses}
              onChange={set("transportationExpenses")}
            />
            <CurrencyWizardInput
              id="wizard-dependent-care"
              placeholder="Monthly Dependent Care Expenses"
              value={formData.dependentCareExpenses}
              onChange={set("dependentCareExpenses")}
            />
          </div>

          <div className="mt-8 max-w-[480px]">
            <ContinueBtn id="wizard-step5-continue" onClick={nextStep} />
          </div>
        </section>
      )}

      {/* ════════════════════ STEP 6: Employment & Health ════════════════════ */}
      {step === 6 && (
        <section aria-labelledby="step6-heading">
          <h2
            id="step6-heading"
            className="text-[1.75rem] font-bold text-[#1a2744] mb-10 leading-tight"
          >
            Employment &amp; Health
          </h2>

          <div className="max-w-[600px] bg-white border border-[#e5e7eb] rounded-lg px-6 py-2">
            <YesNoRow
              id="wizard-currently-employed"
              label="Is the borrower currently employed?"
              value={formData.currentlyEmployed}
              onChange={set("currentlyEmployed")}
            />
            <YesNoRow
              id="wizard-field-of-study"
              label="Does borrower work in a field for which they went to school?"
              value={formData.workInFieldOfStudy}
              onChange={set("workInFieldOfStudy")}
            />
            <YesNoRow
              id="wizard-unemployed-5-years"
              label="Has borrower been unemployed for 5 or more years in the last 10?"
              value={formData.unemployed5Years}
              onChange={set("unemployed5Years")}
            />
            <YesNoRow
              id="wizard-disability"
              label="Does borrower have a disability or chronic injury which limits their ability to work?"
              value={formData.hasDisability}
              onChange={set("hasDisability")}
            />
          </div>

          <div className="mt-8 max-w-[480px]">
            <ContinueBtn id="wizard-step6-continue" onClick={nextStep} />
          </div>
        </section>
      )}

      {/* ════════════════════ STEP 7: Education & Age ════════════════════ */}
      {step === 7 && (
        <section aria-labelledby="step7-heading">
          <h2
            id="step7-heading"
            className="text-[1.75rem] font-bold text-[#1a2744] mb-10 leading-tight"
          >
            Education &amp; Age
          </h2>

          <div className="max-w-[600px] bg-white border border-[#e5e7eb] rounded-lg px-6 py-2">
            <YesNoRow
              id="wizard-did-graduate"
              label="Did borrower graduate?"
              value={formData.didGraduate}
              onChange={set("didGraduate")}
            />
            <YesNoRow
              id="wizard-school-closed"
              label="Is borrower&apos;s school now closed?"
              value={formData.schoolClosed}
              onChange={set("schoolClosed")}
            />

            {/* Last attended school — date */}
            <div className="flex items-start justify-between gap-8 py-3 border-b border-[#f3f4f6]">
              <label
                htmlFor="wizard-last-attended"
                className="text-[0.9375rem] text-[#374151] leading-snug flex-1 pt-0.5 cursor-pointer"
              >
                When did borrower last attend school?
              </label>
              <input
                id="wizard-last-attended"
                type="date"
                value={formData.lastAttendedSchool}
                onChange={(e) => set("lastAttendedSchool")(e.target.value)}
                className="w-40 border border-[#d1d5db] rounded px-3 py-2.5 text-[0.875rem] text-[#1a2744] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/12 bg-white shrink-0 cursor-pointer"
              />
            </div>

            <YesNoRow
              id="wizard-65-or-older"
              label="Is borrower 65 or older?"
              value={formData.is65OrOlder}
              onChange={set("is65OrOlder")}
            />
          </div>

          {/* Final submit button + error banner */}
          <div className="mt-8 max-w-[480px] space-y-3">
            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-[#fca5a5] bg-[#fff1f2] px-4 py-3"
              >
                <svg
                  className="mt-0.5 shrink-0 text-[#dc2626]"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-[0.875rem] text-[#dc2626] leading-snug">{submitError}</p>
              </div>
            )}

            <button
              id="wizard-submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-4 bg-[#1d4ed8] text-white font-bold text-[0.9375rem] tracking-widest uppercase rounded hover:bg-[#1e40af] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer shadow-md"
            >
              {isSubmitting ? "Submitting…" : "Submit Discharge Snapshot"}
            </button>
          </div>
        </section>
      )}

      {/* ════════════════════ Warning Modal (Step 2) ════════════════════ */}
      {showWarning && (
        <div
          id="wizard-warning-overlay"
          className="fixed inset-0 z-[700] flex items-center justify-center"
          style={{ background: "rgba(17,24,39,0.55)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="warning-title"
        >
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-[440px] w-full mx-4 animate-slide-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-full bg-[#fef3c7] flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <h3 id="warning-title" className="text-[1.125rem] font-bold text-[#1a2744]">
                Important Notice
              </h3>
            </div>

            <p className="text-[0.9375rem] text-[#374151] leading-relaxed mb-6">
              Our <strong>Discharge SnapShot</strong> guidance applies specifically to{" "}
              <strong>federal</strong> student loans. If the borrower has private loans,
              these operate under different rules and the analysis results may not apply.
            </p>
            <p className="text-[0.875rem] text-[#6b7280] mb-7 leading-relaxed">
              You can still proceed and complete the analysis. However, please confirm
              the loan type with the borrower before acting on the results.
            </p>

            <button
              id="wizard-warning-proceed-btn"
              onClick={() => {
                setShowWarning(false);
                nextStep();
              }}
              className="w-full py-3 bg-[#1d4ed8] text-white font-semibold text-[0.9375rem] rounded hover:bg-[#1e40af] transition-colors duration-150 cursor-pointer"
            >
              OK, proceed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SVG micro-icon ────────────────────────────────────────────────────────────

function ChevronDownSm() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
