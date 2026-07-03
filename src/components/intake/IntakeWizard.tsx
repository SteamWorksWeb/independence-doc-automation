'use client';

// =============================================================================
// THE INDEPENDENCE LAW FIRM — CLIENT INTAKE WIZARD
// src/components/intake/IntakeWizard.tsx
//
// 5-step DOJ Student Loan Questionnaire.
//
// Migrated from CSS Modules → Tailwind CSS (Phase 2).
// =============================================================================

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const TOTAL_STEPS = 5;

// ── Form state ────────────────────────────────────────────────────────────────
interface FormData {
  // Step 1
  dob:           string;
  ssn:           string;
  county:        string;
  phone:         string;
  address:       string;
  householdSize: string;

  // Step 2
  hasDisability:   boolean;
  isEmployed:      boolean;
  unemployed5of10: boolean;
  hasCar:          boolean;
  monthlyIncome:   string;

  // Step 3
  expFood:         string;
  expHousekeeping: string;
  expApparel:      string;
  expPersonalCare: string;

  // Step 4
  expHousing:      string;
  expUtilities:    string;
  expTransportGas: string;
  expCarInsurance: string;
  unmetBasicNeeds: string;

  // Step 5
  totalDebt:       string;
  studentLoanDebt: string;
  schoolsHistory:  string;
  hardshipNotes:   string;
}

const INITIAL: FormData = {
  dob: '', ssn: '', county: '', phone: '', address: '', householdSize: '',
  hasDisability: false, isEmployed: false, unemployed5of10: false, hasCar: false,
  monthlyIncome: '',
  expFood: '', expHousekeeping: '', expApparel: '', expPersonalCare: '',
  expHousing: '', expUtilities: '', expTransportGas: '', expCarInsurance: '',
  unmetBasicNeeds: '',
  totalDebt: '', studentLoanDebt: '', schoolsHistory: '', hardshipNotes: '',
};

const pf = (s: string) => parseFloat(s) || 0;
const pi = (s: string) => parseInt(s, 10) || 0;

// ── Shared input class strings ────────────────────────────────────────────────
const inputCls =
  "w-full py-3.5 px-4 border-[1.5px] border-border rounded-md bg-white font-sans text-base text-text-primary transition-[border-color,box-shadow] duration-fast appearance-none placeholder:text-text-muted focus:outline-none focus:border-crimson focus:shadow-[0_0_0_3px_rgba(179,30,60,0.1)]";

const labelCls =
  "flex items-center gap-2 font-sans text-[0.8125rem] font-semibold text-text-secondary tracking-[0.06em] uppercase";

// ── Component ─────────────────────────────────────────────────────────────────
export default function IntakeWizard() {
  const router = useRouter();
  const [step, setStep]               = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]             = useState('');
  const [form, setForm]               = useState<FormData>(INITIAL);

  const update = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

  const next = () => { setError(''); setStep((s) => Math.min(s + 1, TOTAL_STEPS)); };
  const prev = () => { setError(''); setStep((s) => Math.max(s - 1, 1)); };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    const payload = {
      dob:     form.dob     || undefined,
      ssn:     form.ssn     || undefined,
      county:  form.county  || undefined,
      phone:   form.phone   || undefined,
      address: form.address || undefined,
      householdSize:   pi(form.householdSize),
      hasDisability:   form.hasDisability,
      isEmployed:      form.isEmployed,
      unemployed5of10: form.unemployed5of10,
      hasCar:          form.hasCar,
      monthlyIncome:   pf(form.monthlyIncome),
      expFood:         pf(form.expFood),
      expHousekeeping: pf(form.expHousekeeping),
      expApparel:      pf(form.expApparel),
      expPersonalCare: pf(form.expPersonalCare),
      expHousing:      pf(form.expHousing),
      expUtilities:    pf(form.expUtilities),
      expTransportGas: pf(form.expTransportGas),
      expCarInsurance: pf(form.expCarInsurance),
      unmetBasicNeeds: form.unmetBasicNeeds || undefined,
      totalDebt:       pf(form.totalDebt),
      studentLoanDebt: pf(form.studentLoanDebt),
      schoolsHistory:  form.schoolsHistory  || undefined,
      hardshipNotes:   form.hardshipNotes   || undefined,
      isCompleted: true,
    };

    try {
      const res = await fetch('/api/intake', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to save intake profile.');
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const pct = ((step / TOTAL_STEPS) * 100).toFixed(0);

  // ── Input helpers ─────────────────────────────────────────────────────────
  const textInput = (id: keyof FormData, label: string, opts?: {
    type?: string; placeholder?: string; colSpan?: boolean;
  }) => (
    <div className={opts?.colSpan ? 'col-span-full' : undefined}>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input
        id={id}
        type={opts?.type ?? 'text'}
        className={inputCls}
        value={form[id] as string}
        onChange={(e) => update(id, e.target.value as never)}
        placeholder={opts?.placeholder}
      />
    </div>
  );

  const numInput = (id: keyof FormData, label: string) => (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="relative flex items-center">
        <span className="absolute left-4 text-base text-text-muted font-medium pointer-events-none">$</span>
        <input
          id={id}
          type="number"
          min="0"
          step="1"
          className={`${inputCls} pl-8`}
          value={form[id] as string}
          onChange={(e) => update(id, e.target.value as never)}
          placeholder="0.00"
        />
      </div>
    </div>
  );

  const checkRow = (id: keyof FormData, label: string) => (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer py-2">
      <input
        id={id}
        type="checkbox"
        className="w-[18px] h-[18px] shrink-0 mt-0.5 accent-crimson cursor-pointer"
        checked={form[id] as boolean}
        onChange={(e) => update(id, e.target.checked as never)}
      />
      <span className="text-[0.9375rem] text-text-primary leading-[1.5] cursor-pointer">{label}</span>
    </label>
  );

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-start pt-10 px-4 pb-16">
      <header className="text-center mb-8">
        <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-2">
          The Independence Law Firm
        </p>
        <h1 className="font-serif text-[clamp(1.5rem,3vw,2.25rem)] text-navy mb-2">
          DOJ Student Loan Questionnaire
        </h1>
        <p className="text-[0.9375rem] text-text-muted max-w-[440px] mx-auto">
          Your information is protected by attorney-client privilege and
          256-bit encryption.
        </p>
      </header>

      <div className="w-full max-w-[640px] bg-white rounded-xl shadow-xl overflow-hidden">
        {/* ── Progress header ─────────────────────────────────────────── */}
        <div className="bg-navy py-6 px-8 max-[680px]:py-5 max-[680px]:px-5">
          <div className="flex justify-between items-center mb-4">
            <span className="font-sans text-[0.8125rem] font-semibold tracking-[0.08em] uppercase text-white/60">
              Progress
            </span>
            <span className="font-serif text-[1.125rem] text-white font-bold">
              Step {step} of {TOTAL_STEPS}
            </span>
          </div>
          <div className="h-[3px] bg-white/[0.12] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-crimson to-[#e05275] rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-[0_0_8px_rgba(179,30,60,0.5)]"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
            />
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="p-8 max-[680px]:p-6">
          {error && (
            <div className="flex items-start gap-3 p-4 bg-error-bg border border-[rgba(192,57,43,0.2)] rounded-md mb-5" role="alert">
              <span className="text-base shrink-0 mt-px">⚠️</span>
              <span className="text-sm text-error leading-[1.5]">{error}</span>
            </div>
          )}

          {/* ── STEP 1: Personal & Household ──────────────────────────── */}
          {step === 1 && (
            <div key="s1" className="min-h-[280px] animate-[stepEnter_0.35s_cubic-bezier(0.4,0,0.2,1)_both]">
              <h2 className="font-serif text-[1.375rem] text-navy mb-2">Personal &amp; Household Information</h2>
              <div className="grid grid-cols-2 gap-4 mb-5 max-[540px]:grid-cols-1">
                {textInput('dob',  'Date of Birth',          { placeholder: 'MM/DD/YYYY' })}
                {textInput('ssn',  'Social Security Number', { type: 'password', placeholder: 'XXX-XX-XXXX' })}
                {textInput('address', 'Full Address',        { colSpan: true, placeholder: '123 Main St, City, State, ZIP' })}
                {textInput('county', 'County')}
                {textInput('phone',  'Phone Number',         { type: 'tel', placeholder: '(555) 555-5555' })}
                <div>
                  <label htmlFor="householdSize" className={labelCls}>
                    Additional Household Members
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-base text-text-muted font-medium pointer-events-none">#</span>
                    <input
                      id="householdSize"
                      type="number"
                      min="0"
                      className={`${inputCls} pl-8`}
                      value={form.householdSize}
                      onChange={(e) => update('householdSize', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Health, Employment & Assets ───────────────────── */}
          {step === 2 && (
            <div key="s2" className="min-h-[280px] animate-[stepEnter_0.35s_cubic-bezier(0.4,0,0.2,1)_both]">
              <h2 className="font-serif text-[1.375rem] text-navy mb-2">Health, Employment &amp; Assets</h2>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 mb-2">
                  {checkRow('hasDisability',   'Do you have a disability or chronic injury impacting income potential?')}
                  {checkRow('isEmployed',       'Are you currently employed?')}
                  {checkRow('unemployed5of10',  'Have you been unemployed for at least 5 of the last 10 years?')}
                  {checkRow('hasCar',           'Do you own a vehicle?')}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="monthlyIncome" className={labelCls}>
                    Gross Monthly Income ($)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-base text-text-muted font-medium pointer-events-none">$</span>
                    <input
                      id="monthlyIncome"
                      type="number"
                      min="0"
                      step="100"
                      className={`${inputCls} pl-8`}
                      value={form.monthlyIncome}
                      onChange={(e) => update('monthlyIncome', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Monthly Expenses Pt. 1 ───────────────────────── */}
          {step === 3 && (
            <div key="s3" className="min-h-[280px] animate-[stepEnter_0.35s_cubic-bezier(0.4,0,0.2,1)_both]">
              <h2 className="font-serif text-[1.375rem] text-navy mb-2">Average Monthly Expenses</h2>
              <p className="text-sm text-text-muted mb-6 leading-relaxed py-3 px-4 bg-bg rounded-md border-l-[3px] border-crimson-light">
                Enter 0 if an expense does not apply to you.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-5 max-[540px]:grid-cols-1">
                {numInput('expFood',         'Food')}
                {numInput('expHousekeeping', 'Housekeeping Supplies')}
                {numInput('expApparel',      'Apparel & Services')}
                {numInput('expPersonalCare', 'Personal Care Products')}
              </div>
            </div>
          )}

          {/* ── STEP 4: Housing & Transportation ─────────────────────── */}
          {step === 4 && (
            <div key="s4" className="min-h-[280px] animate-[stepEnter_0.35s_cubic-bezier(0.4,0,0.2,1)_both]">
              <h2 className="font-serif text-[1.375rem] text-navy mb-2">Housing &amp; Transportation</h2>
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4 mb-5 max-[540px]:grid-cols-1">
                  {numInput('expHousing',      'Housing (Rent / Mortgage)')}
                  {numInput('expUtilities',    'Utilities (Gas, Electric, Water)')}
                  {numInput('expTransportGas', 'Vehicle Gas')}
                  {numInput('expCarInsurance', 'Car Insurance')}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="unmetBasicNeeds" className={labelCls}>
                    Unmet Basic Needs
                  </label>
                  <p className="text-[0.8125rem] text-text-muted leading-[1.5] mb-2">
                    Are there basic expenses you currently cannot afford? Detail why they are necessary.
                  </p>
                  <textarea
                    id="unmetBasicNeeds"
                    className={`${inputCls} resize-y min-h-[140px] leading-relaxed`}
                    value={form.unmetBasicNeeds}
                    onChange={(e) => update('unmetBasicNeeds', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Education & Hardship ─────────────────────────── */}
          {step === 5 && (
            <div key="s5" className="min-h-[280px] animate-[stepEnter_0.35s_cubic-bezier(0.4,0,0.2,1)_both]">
              <h2 className="font-serif text-[1.375rem] text-navy mb-2">Education &amp; Case Narrative</h2>
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4 mb-5 max-[540px]:grid-cols-1">
                  {numInput('totalDebt',       'Total Estimated Debt')}
                  {numInput('studentLoanDebt', 'Student Loan Debt')}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="schoolsHistory" className={labelCls}>
                    Schools Attended
                  </label>
                  <p className="text-[0.8125rem] text-text-muted leading-[1.5] mb-2">
                    List all schools, graduation dates, and degrees received where you incurred student loan debt.
                  </p>
                  <textarea
                    id="schoolsHistory"
                    className={`${inputCls} resize-y min-h-[140px] leading-relaxed`}
                    value={form.schoolsHistory}
                    onChange={(e) => update('schoolsHistory', e.target.value)}
                    placeholder={
                      'e.g. San Francisco State University — No Degree\n' +
                      '     Texas Southern University — B.S. Business (May 2020)…'
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="hardshipNotes" className={labelCls}>
                    Hardship Narrative
                  </label>
                  <p className="text-[0.8125rem] text-text-muted leading-[1.5] mb-2">
                    Provide any additional information in support of your &quot;undue hardship&quot;.
                  </p>
                  <textarea
                    id="hardshipNotes"
                    className={`${inputCls} resize-y min-h-[140px] leading-relaxed`}
                    value={form.hardshipNotes}
                    onChange={(e) => update('hardshipNotes', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation ──────────────────────────────────────────────── */}
        <div className="flex justify-between items-center py-5 px-8 max-[680px]:py-4 max-[680px]:px-5 border-t border-border gap-4">
          {step > 1 ? (
            <button
              id="intake-back"
              className="inline-flex items-center gap-2 py-3 px-5 bg-transparent border-[1.5px] border-border rounded-md font-sans text-[0.9375rem] font-medium text-text-secondary cursor-pointer transition-all duration-fast hover:border-navy hover:text-navy hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={prev}
              disabled={isSubmitting}
              type="button"
            >
              Back
            </button>
          ) : (
            <div className="flex-1" />
          )}

          {step < TOTAL_STEPS ? (
            <button
              id="intake-next"
              className="inline-flex items-center gap-2 py-3 px-7 bg-navy border-none rounded-md font-sans text-[0.9375rem] font-semibold text-white cursor-pointer transition-all duration-fast shadow-sm hover:bg-navy-hover hover:shadow-md hover:-translate-y-px"
              onClick={next}
              type="button"
            >
              Next
            </button>
          ) : (
            <button
              id="intake-submit"
              className="inline-flex items-center gap-2 py-3 px-7 bg-crimson border-none rounded-md font-sans text-[0.9375rem] font-semibold text-white cursor-pointer transition-all duration-fast shadow-[0_2px_8px_rgba(179,30,60,0.35)] hover:bg-crimson-hover hover:shadow-[0_4px_16px_rgba(179,30,60,0.45)] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              onClick={handleSubmit}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting
                ? <><span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin shrink-0" /> Submitting…</>
                : 'Submit Profile'}
            </button>
          )}
        </div>
      </div>

      <p className="flex items-center justify-center gap-2 mt-6 text-[0.8125rem] text-text-muted [&_svg]:shrink-0">
        <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true">
          <path d="M6.5 1L1 3.5v4c0 3.1 2.3 6 5.5 6.5C9.7 13.5 12 10.6 12 7.5v-4L6.5 1z"
            stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
          <path d="M4.5 7l1.5 1.5L8.5 5" stroke="currentColor" strokeWidth="1.3"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        256-bit encrypted · Attorney-client privileged · Never sold or shared
      </p>
    </div>
  );
}
