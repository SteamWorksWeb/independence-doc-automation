"use client";

/**
 * src/app/onboarding/page.tsx
 *
 * Client-facing 7-step Discharge SnapShot intake wizard.
 * Route: /onboarding  (protected by middleware — requires client_token cookie)
 *
 * This is a 1:1 clone of the admin wizard at /admin/leads/new in terms of
 * form fields, UI components, state shape, and schema field names.
 * All field names exactly match the Prisma DischargeSnapshot model.
 *
 * Steps:
 *   1 — Your Information    (First Name, Last Name, Email, Phone)
 *   2 — Student Loans       (block buttons: Yes / No / I don't know + warning modal)
 *   3 — Outstanding Balance ($ balance input + household size dropdown)
 *   4 — Monthly Income      (Gross Income + Take-Home Pay)
 *   5 — Monthly Expenses    (Additional income, Housing, Transportation, Dependent care)
 *   6 — Employment & Health (4 × Yes/No dropdowns)
 *   7 — Education & Age     (3 × Yes/No + date + Yes/No)
 *
 * On final step submission:
 *   - POSTs to the Next.js proxy  POST /api/intake/snapshot
 *   - Proxy reads client_token cookie and forwards to backend
 *   - Backend: POST /api/v1/intake/snapshot → creates DischargeSnapshot
 *   - 200 success → router.push("/dashboard")
 *   - Non-200    → inline error banner shown to the user
 *
 * No checkboxes are used anywhere — all boolean fields use explicit
 * <select> dropdowns (Yes/No) or block buttons matching the admin wizard.
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ── Constants ──────────────────────────────────────────────────────────────────

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

// ── Form state — field names match Prisma DischargeSnapshot exactly ───────────

interface FormData {
  // Step 1
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  ssn: string;
  // Step 2
  hasFederalLoans: string;
  // Step 3
  principalBalance: string;
  householdSize: string;
  // Step 4
  monthlyGrossIncome: string;
  monthlyTakeHomePay: string;
  // Step 5
  additionalIncome: string;
  housingExpenses: string;
  transportationExpenses: string;
  dependentCareExpenses: string;
  // Step 6
  isEmployed: string;
  workInFieldOfStudy: string;
  unemployed5PlusYears: string;
  hasDisability: string;
  // Step 7
  didGraduate: string;
  schoolClosed: string;
  lastAttendedSchool: string;
  is65OrOlder: string;
  appliedForIDR: string;
  madePriorPayments: string;
  contactedServicer: string;
}

const INITIAL_FORM: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dob: "",
  ssn: "",
  hasFederalLoans: "",
  principalBalance: "",
  householdSize: "1",
  monthlyGrossIncome: "",
  monthlyTakeHomePay: "",
  additionalIncome: "",
  housingExpenses: "",
  transportationExpenses: "",
  dependentCareExpenses: "",
  isEmployed: "Yes",
  workInFieldOfStudy: "Yes",
  unemployed5PlusYears: "No",
  hasDisability: "No",
  didGraduate: "Yes",
  schoolClosed: "No",
  lastAttendedSchool: "",
  is65OrOlder: "No",
  appliedForIDR: "No",
  madePriorPayments: "No",
  contactedServicer: "No",
};

function normalizeDob(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-");
    return `${month}/${day}/${year}`;
  }

  if (/^\d{8}$/.test(digits)) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  return trimmed;
}

function toInt(value: string, fallback = 0): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalDate(value: string): string | undefined {
  return normalizeDob(value) || undefined;
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractBorrowerEmail(value: unknown): string {
  if (!isRecord(value)) return "";

  for (const key of ["email", "borrowerEmail", "clientEmail"]) {
    const email = normalizeEmail(value[key]);
    if (email) return email;
  }

  for (const key of ["borrower", "client", "user", "session", "profile"]) {
    const nested = value[key];
    if (isRecord(nested)) {
      const email = extractBorrowerEmail(nested);
      if (email) return email;
    }
  }

  return "";
}

function formatSsn(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

// ── Shared field styles ────────────────────────────────────────────────────────

const inputCls =
  "w-full px-5 py-4 text-[0.9375rem] text-[#1a2744] outline-none bg-transparent placeholder:text-transparent";

const selectRowCls =
  "w-36 border border-[#d1d5db] rounded px-3 py-2.5 text-[0.875rem] text-[#1a2744] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/12 bg-white cursor-pointer appearance-none shrink-0";

// ── Sub-components (cloned from admin wizard) ─────────────────────────────────

/** Floating-label text input — label visible only when field is empty */
function WizardInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = true,
  disabled = false,
  inputMode,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) {
  return (
    <div className="relative border border-[#d1d5db] rounded bg-white hover:border-[#9ca3af] focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/12 transition-all duration-150">
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        className={inputCls}
        autoComplete="off"
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
      />
      {!value && type !== "date" && (
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
        name={id}
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
      <label
        htmlFor={id}
        className="text-[0.9375rem] text-[#374151] leading-snug flex-1 pt-0.5 cursor-pointer"
      >
        {label}
      </label>
      <div className="relative shrink-0">
        <select
          id={id}
          name={id}
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
  disabled = false,
}: {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      disabled={disabled}
      className="px-8 py-3.5 bg-[#1d4ed8] text-white font-semibold text-[0.9375rem] rounded hover:bg-[#1e40af] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer shadow-sm"
    >
      {label}
    </button>
  );
}

/** Continue button (crimson, full-width up to max) */
function ContinueBtn({
  id,
  onClick,
  label = "CONTINUE",
}: {
  id: string;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      className="w-full max-w-md py-4 bg-[#b31e3c] text-white font-bold text-[0.9375rem] tracking-widest uppercase rounded hover:bg-[#9b1a33] transition-colors duration-150 cursor-pointer shadow-sm"
    >
      {label}
    </button>
  );
}

// ── Main wizard component ──────────────────────────────────────────────────────

export default function OnboardingPage({
  initialEmail = "",
}: {
  initialEmail?: string;
} = {}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showWarning, setShowWarning] = useState(false);
  const [formData, setFormData] = useState<FormData>(() => ({
    ...INITIAL_FORM,
    email: initialEmail,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (key: keyof FormData) => (value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const email = normalizeEmail(initialEmail);
    if (!email) return;
    setFormData((prev) => (prev.email ? prev : { ...prev, email }));
  }, [initialEmail]);

  useEffect(() => {
    if (formData.email) return;

    let cancelled = false;

    async function loadBorrowerEmail() {
      try {
        const res = await fetch("/api/public/auth/borrower-session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = res.ok ? await res.json().catch(() => ({})) : {};
        let email = extractBorrowerEmail(data);

        if (!email) {
          const intakeRes = await fetch("/api/intake", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          });
          const intakeData = intakeRes.ok ? await intakeRes.json().catch(() => ({})) : {};
          email = extractBorrowerEmail(intakeData);
        }

        if (!cancelled && email) {
          setFormData((prev) => ({ ...prev, email }));
        }
      } catch {
        // Keep the field locked; the session proxy is the source of truth.
      }
    }

    void loadBorrowerEmail();

    return () => {
      cancelled = true;
    };
  }, [formData.email]);

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

  async function handleClientSetupContinue() {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phone: formData.phone || undefined,
          dob: toOptionalDate(formData.dob),
          ssn: formData.ssn || undefined,
          householdSize: Number.parseInt(formData.householdSize, 10) || 1,
        }),
      });

      if (!res.ok) {
        let errMsg = `Unable to save client setup (HTTP ${res.status}). Please try again.`;
        try {
          const errBody = await res.json();
          if (errBody?.error) errMsg = errBody.error;
          if (errBody?.message) errMsg = errBody.message;
        } catch {
          // ignore JSON parse failure
        }
        setSubmitError(errMsg);
        return;
      }

      nextStep();
    } catch (networkErr) {
      console.error("[onboarding/client-setup] Network error:", networkErr);
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);

    const snapshotPayload = {
      hasFederalLoans: formData.hasFederalLoans,
      principalBalance: formData.principalBalance,
      householdSize: toInt(formData.householdSize, 1),
      monthlyGrossIncome: formData.monthlyGrossIncome,
      monthlyTakeHomePay: formData.monthlyTakeHomePay,
      additionalIncome: formData.additionalIncome,
      housingExpenses: formData.housingExpenses,
      transportationExpenses: formData.transportationExpenses,
      dependentCareExpenses: formData.dependentCareExpenses,
      isEmployed: formData.isEmployed,
      workInFieldOfStudy: formData.workInFieldOfStudy,
      unemployed5PlusYears: formData.unemployed5PlusYears,
      hasDisability: formData.hasDisability,
      didGraduate: formData.didGraduate,
      schoolClosed: formData.schoolClosed,
      is65OrOlder: formData.is65OrOlder,
      lastAttendedSchool: toOptionalDate(formData.lastAttendedSchool),
      appliedForIDR: formData.appliedForIDR,
      madePriorPayments: formData.madePriorPayments,
      contactedServicer: formData.contactedServicer,
    };

    try {
      const res = await fetch("/api/intake/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(snapshotPayload),
      });

      if (res.ok) {
        router.push("/dashboard");
        return;
      }

      let errMsg = `Submission failed (HTTP ${res.status}). Please try again.`;
      try {
        const errBody = await res.json();
        if (errBody?.error)   errMsg = errBody.error;
        if (errBody?.message) errMsg = errBody.message;
      } catch {
        // ignore JSON parse failure
      }
      setSubmitError(errMsg);
    } catch (networkErr) {
      console.error("[onboarding/handleSubmit] Network error:", networkErr);
      setSubmitError("Network error — please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f7] py-12 px-4">
      {/* ── Firm logo strip ─────────────────────────────────────────────────── */}
      <div className="hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Liberty logo"
          className="h-10 w-auto object-contain"
        />
      </div>

      {/* ── Wizard card ─────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1026px]">

        {/* ── Progress bar (steps 2–7) ────────────────────────────────────── */}
        {step > 1 && (
          <div className="mb-10">
            <div className="h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#b31e3c] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={prevStep}
                className="text-[#b31e3c] text-[0.875rem] flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span aria-hidden>←</span>
                <span>{STEP_LABELS[step - 1]}</span>
              </button>
              <span className="text-[0.8125rem] text-[#9ca3af]">
                Step {step} of {TOTAL_STEPS}
              </span>
            </div>
          </div>
        )}

        {/* ══════════════ STEP 1: Your Information ══════════════ */}
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
                id="firstName"
                label="Borrower First Name"
                value={formData.firstName}
                onChange={set("firstName")}
              />
              <WizardInput
                id="lastName"
                label="Borrower Last Name"
                value={formData.lastName}
                onChange={set("lastName")}
              />
              <WizardInput
                id="email"
                label="Borrower Email"
                value={formData.email}
                onChange={() => undefined}
                type="email"
                disabled={true}
              />
              <WizardInput
                id="phone"
                label="Borrower Phone"
                value={formData.phone}
                onChange={set("phone")}
                type="tel"
              />
              <WizardInput
                id="dob"
                label="Birth Date"
                value={formData.dob}
                onChange={set("dob")}
                type="date"
                required={false}
              />
              <WizardInput
                id="ssn"
                label="Social Security Number"
                value={formData.ssn}
                onChange={(value) => set("ssn")(formatSsn(value))}
                type="text"
                inputMode="numeric"
                maxLength={11}
                required={false}
              />
            </div>

            {submitError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-3 rounded-lg border border-[#fca5a5] bg-[#fff1f2] px-4 py-3"
              >
                <p className="text-[0.875rem] text-[#dc2626] leading-snug">
                  {submitError}
                </p>
              </div>
            )}

            <div className="mt-8">
              <PrimaryBtn
                id="intake-step1-continue"
                label={isSubmitting ? "Saving..." : "Save and Continue"}
                onClick={handleClientSetupContinue}
                disabled={isSubmitting}
              />
            </div>
          </section>
        )}

        {/* ══════════════ STEP 2: Student Loans ══════════════ */}
        {step === 2 && (
          <section aria-labelledby="step2-heading">
            <h2
              id="step2-heading"
              className="text-[1.75rem] font-bold text-[#1a2744] mb-10 leading-tight"
            >
              Do you have federal student loans?
            </h2>

            <div className="space-y-3 max-w-[480px]">
              {(["Yes", "No", "I don't know"] as const).map((option) => (
                <button
                  type="button"
                  key={option}
                  id={`intake-loans-${option.toLowerCase().replace(/[\s']/g, "-")}`}
                  onClick={() => handleFederalLoans(option)}
                  className="w-full py-5 bg-[#1a2744] text-white text-[1rem] font-medium rounded-md hover:bg-[#2d3d6b] active:scale-[0.99] transition-all duration-150 cursor-pointer"
                >
                  {option}
                </button>
              ))}
            </div>

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
                . If you see your loans listed on this site, they are federal.
                If they are not listed, they are private.
              </p>
            </div>
          </section>
        )}

        {/* ══════════════ STEP 3: Outstanding Balance ══════════════ */}
        {step === 3 && (
          <section aria-labelledby="step3-heading">
            <h2
              id="step3-heading"
              className="text-[1.75rem] font-bold text-[#1a2744] mb-10 leading-tight"
            >
              What is the outstanding balance on your student loans?
            </h2>

            <div className="space-y-4 max-w-[480px]">
              <CurrencyWizardInput
                id="principalBalance"
                placeholder="Outstanding Principal Balance"
                value={formData.principalBalance}
                onChange={set("principalBalance")}
              />

              {/* Household size */}
              <div className="relative border border-[#d1d5db] rounded bg-white hover:border-[#9ca3af] focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/12 transition-all duration-150 overflow-hidden flex items-center">
                <span className="px-4 py-3.5 text-[#6b7280] text-[0.875rem] whitespace-nowrap border-r border-[#d1d5db] bg-[#f9fafb] shrink-0">
                  Household size
                </span>
                <select
                  id="householdSize"
                  name="householdSize"
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

            <div className="mt-6 max-w-[480px] border border-[#e5e7eb] rounded-lg p-4 text-center bg-[#fafafa]">
              <p className="text-[0.875rem] text-[#6b7280] italic">
                Estimate your balance as best you can.
              </p>
            </div>

            <div className="mt-7 max-w-[480px]">
              <ContinueBtn id="intake-step3-continue" onClick={nextStep} />
            </div>
          </section>
        )}

        {/* ══════════════ STEP 4: Monthly Income ══════════════ */}
        {step === 4 && (
          <section aria-labelledby="step4-heading">
            <h2
              id="step4-heading"
              className="text-[1.75rem] font-bold text-[#1a2744] mb-10 leading-tight"
            >
              What is your monthly gross income and take-home pay?
            </h2>

            <div className="space-y-4 max-w-[480px]">
              <CurrencyWizardInput
                id="monthlyGrossIncome"
                placeholder="Monthly Gross Income"
                value={formData.monthlyGrossIncome}
                onChange={set("monthlyGrossIncome")}
              />
              <CurrencyWizardInput
                id="monthlyTakeHomePay"
                placeholder="Monthly Take-Home Pay"
                value={formData.monthlyTakeHomePay}
                onChange={set("monthlyTakeHomePay")}
              />
            </div>

            <div className="mt-8 max-w-[480px]">
              <ContinueBtn id="intake-step4-continue" onClick={nextStep} />
            </div>
          </section>
        )}

        {/* ══════════════ STEP 5: Monthly Expenses ══════════════ */}
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
                id="additionalIncome"
                placeholder="Additional Monthly Income (household)"
                value={formData.additionalIncome}
                onChange={set("additionalIncome")}
              />
              <CurrencyWizardInput
                id="housingExpenses"
                placeholder="Monthly Housing Expenses"
                value={formData.housingExpenses}
                onChange={set("housingExpenses")}
              />
              <CurrencyWizardInput
                id="transportationExpenses"
                placeholder="Transportation Expenses"
                value={formData.transportationExpenses}
                onChange={set("transportationExpenses")}
              />
              <CurrencyWizardInput
                id="dependentCareExpenses"
                placeholder="Monthly Dependent Care Expenses"
                value={formData.dependentCareExpenses}
                onChange={set("dependentCareExpenses")}
              />
            </div>

            <div className="mt-8 max-w-[480px]">
              <ContinueBtn id="intake-step5-continue" onClick={nextStep} />
            </div>
          </section>
        )}

        {/* ══════════════ STEP 6: Employment & Health ══════════════ */}
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
                id="isEmployed"
                label="Are you currently employed?"
                value={formData.isEmployed}
                onChange={set("isEmployed")}
              />
              <YesNoRow
                id="workInFieldOfStudy"
                label="Do you work in a field for which you went to school?"
                value={formData.workInFieldOfStudy}
                onChange={set("workInFieldOfStudy")}
              />
              <YesNoRow
                id="unemployed5PlusYears"
                label="Have you been unemployed for 5 or more years in the last 10?"
                value={formData.unemployed5PlusYears}
                onChange={set("unemployed5PlusYears")}
              />
              <YesNoRow
                id="hasDisability"
                label="Do you have a disability or chronic injury which limits your ability to work?"
                value={formData.hasDisability}
                onChange={set("hasDisability")}
              />
            </div>

            <div className="mt-8 max-w-[480px]">
              <ContinueBtn id="intake-step6-continue" onClick={nextStep} />
            </div>
          </section>
        )}

        {/* ══════════════ STEP 7: Education & Age ══════════════ */}
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
                id="didGraduate"
                label="Did you graduate?"
                value={formData.didGraduate}
                onChange={set("didGraduate")}
              />
              <YesNoRow
                id="schoolClosed"
                label="Is your school now closed?"
                value={formData.schoolClosed}
                onChange={set("schoolClosed")}
              />

              {/* Last attended school — date */}
              <div className="flex items-start justify-between gap-8 py-3 border-b border-[#f3f4f6]">
                <label
                  htmlFor="lastAttendedSchool"
                  className="text-[0.9375rem] text-[#374151] leading-snug flex-1 pt-0.5 cursor-pointer"
                >
                  When did you last attend school?
                </label>
                <input
                  id="lastAttendedSchool"
                  name="lastAttendedSchool"
                  type="date"
                  value={formData.lastAttendedSchool}
                  onChange={(e) => set("lastAttendedSchool")(e.target.value)}
                  className="w-40 border border-[#d1d5db] rounded px-3 py-2.5 text-[0.875rem] text-[#1a2744] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/12 bg-white shrink-0 cursor-pointer"
                />
              </div>

              <YesNoRow
                id="is65OrOlder"
                label="Are you 65 or older?"
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
                  <p className="text-[0.875rem] text-[#dc2626] leading-snug">
                    {submitError}
                  </p>
                </div>
              )}

              <button
                type="button"
                id="intake-submit-btn"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 bg-[#1d4ed8] text-white font-bold text-[0.9375rem] tracking-widest uppercase rounded hover:bg-[#1e40af] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer shadow-md"
              >
                {isSubmitting ? "Submitting…" : "Submit My Information"}
              </button>
            </div>
          </section>
        )}
      </div>

      {/* ── Legal footer ──────────────────────────────────────────────────────── */}
      <p className="hidden">
        All information is protected by attorney-client privilege and 256-bit
        SSL encryption.
      </p>

      {/* ══════════════ Warning Modal (Step 2 — No / I don't know) ══════════ */}
      {showWarning && (
        <div
          id="intake-warning-overlay"
          className="fixed inset-0 z-[700] flex items-center justify-center"
          style={{ background: "rgba(17,24,39,0.55)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="intake-warning-title"
        >
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-[440px] w-full mx-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-full bg-[#fef3c7] flex items-center justify-center shrink-0">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <h3
                id="intake-warning-title"
                className="text-[1.125rem] font-bold text-[#1a2744]"
              >
                Important Notice
              </h3>
            </div>

            <p className="text-[0.9375rem] text-[#374151] leading-relaxed mb-6">
              Our <strong>Discharge SnapShot</strong> guidance applies
              specifically to <strong>federal</strong> student loans. If you
              have private loans, these operate under different rules and the
              analysis results may not apply.
            </p>
            <p className="text-[0.875rem] text-[#6b7280] mb-7 leading-relaxed">
              You can still proceed and complete the analysis. However, please
              confirm your loan type with your attorney before acting on the
              results.
            </p>

            <button
              id="intake-warning-proceed-btn"
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

// ── SVG micro-icon ─────────────────────────────────────────────────────────────

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
