'use client';

// =============================================================================
// THE INDEPENDENCE LAW FIRM — CLIENT INTAKE WIZARD
// src/components/intake/IntakeWizard.tsx
//
// 5-step DOJ Student Loan Questionnaire. Maps directly to the IntakeProfile
// schema (DOJ attestation fields).
//
// Submits through /api/intake (Next.js proxy) — the HttpOnly client_token
// cookie is read server-side. localStorage is never touched.
//
// Steps:
//   1 — Personal & Household      (dob, ssn, county, phone, address, householdSize)
//   2 — Health, Employment & Assets (checkboxes + monthlyIncome)
//   3 — Monthly Expenses Pt. 1    (food, housekeeping, apparel, personal care)
//   4 — Housing & Transportation  (housing, utilities, gas, car insurance, unmetBasicNeeds)
//   5 — Education & Hardship      (debt totals, schoolsHistory, hardshipNotes)
// =============================================================================

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './IntakeWizard.module.css';

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
      // ── Call the Next.js proxy — NOT Render directly.
      //    The proxy reads the HttpOnly client_token cookie server-side.
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
    <div className={opts?.colSpan ? styles.colSpan2 : undefined}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <input
        id={id}
        type={opts?.type ?? 'text'}
        className={styles.input}
        value={form[id] as string}
        onChange={(e) => update(id, e.target.value as never)}
        placeholder={opts?.placeholder}
      />
    </div>
  );

  const numInput = (id: keyof FormData, label: string) => (
    <div>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.inputWrapper}>
        <span className={styles.inputPrefix}>$</span>
        <input
          id={id}
          type="number"
          min="0"
          step="1"
          className={styles.input}
          value={form[id] as string}
          onChange={(e) => update(id, e.target.value as never)}
          placeholder="0.00"
        />
      </div>
    </div>
  );

  const checkRow = (id: keyof FormData, label: string) => (
    <label htmlFor={id} className={styles.checkRow}>
      <input
        id={id}
        type="checkbox"
        className={styles.checkbox}
        checked={form[id] as boolean}
        onChange={(e) => update(id, e.target.checked as never)}
      />
      <span className={styles.checkLabel}>{label}</span>
    </label>
  );

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.headerEyebrow}>The Independence Law Firm</p>
        <h1 className={styles.headerTitle}>DOJ Student Loan Questionnaire</h1>
        <p className={styles.headerSubtitle}>
          Your information is protected by attorney-client privilege and
          256-bit encryption.
        </p>
      </header>

      <div className={styles.card}>
        {/* ── Progress header ─────────────────────────────────────────── */}
        <div className={styles.progressHeader}>
          <div className={styles.progressMeta}>
            <span className={styles.progressLabel}>Progress</span>
            <span className={styles.progressCount}>Step {step} of {TOTAL_STEPS}</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
            />
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className={styles.body}>
          {error && (
            <div className={styles.errorAlert} role="alert">
              <span className={styles.errorIcon}>⚠️</span>
              <span className={styles.errorText}>{error}</span>
            </div>
          )}

          {/* ── STEP 1: Personal & Household ──────────────────────────── */}
          {step === 1 && (
            <div key="s1" className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Personal &amp; Household Information</h2>
              <div className={styles.grid2}>
                {textInput('dob',  'Date of Birth',          { placeholder: 'MM/DD/YYYY' })}
                {textInput('ssn',  'Social Security Number', { type: 'password', placeholder: 'XXX-XX-XXXX' })}
                {textInput('address', 'Full Address',        { colSpan: true, placeholder: '123 Main St, City, State, ZIP' })}
                {textInput('county', 'County')}
                {textInput('phone',  'Phone Number',         { type: 'tel', placeholder: '(555) 555-5555' })}
                <div>
                  <label htmlFor="householdSize" className={styles.label}>
                    Additional Household Members
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputPrefix}>#</span>
                    <input
                      id="householdSize"
                      type="number"
                      min="0"
                      className={styles.input}
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
            <div key="s2" className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Health, Employment &amp; Assets</h2>
              <div className={styles.fieldGroup}>
                <div className={styles.checkList}>
                  {checkRow('hasDisability',   'Do you have a disability or chronic injury impacting income potential?')}
                  {checkRow('isEmployed',       'Are you currently employed?')}
                  {checkRow('unemployed5of10',  'Have you been unemployed for at least 5 of the last 10 years?')}
                  {checkRow('hasCar',           'Do you own a vehicle?')}
                </div>
                <div className={styles.field}>
                  <label htmlFor="monthlyIncome" className={styles.label}>
                    Gross Monthly Income ($)
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputPrefix}>$</span>
                    <input
                      id="monthlyIncome"
                      type="number"
                      min="0"
                      step="100"
                      className={styles.input}
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
            <div key="s3" className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Average Monthly Expenses</h2>
              <p className={styles.stepDescription}>
                Enter 0 if an expense does not apply to you.
              </p>
              <div className={styles.grid2}>
                {numInput('expFood',         'Food')}
                {numInput('expHousekeeping', 'Housekeeping Supplies')}
                {numInput('expApparel',      'Apparel &amp; Services')}
                {numInput('expPersonalCare', 'Personal Care Products')}
              </div>
            </div>
          )}

          {/* ── STEP 4: Housing & Transportation ─────────────────────── */}
          {step === 4 && (
            <div key="s4" className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Housing &amp; Transportation</h2>
              <div className={styles.fieldGroup}>
                <div className={styles.grid2}>
                  {numInput('expHousing',      'Housing (Rent / Mortgage)')}
                  {numInput('expUtilities',    'Utilities (Gas, Electric, Water)')}
                  {numInput('expTransportGas', 'Vehicle Gas')}
                  {numInput('expCarInsurance', 'Car Insurance')}
                </div>
                <div className={styles.field}>
                  <label htmlFor="unmetBasicNeeds" className={styles.label}>
                    Unmet Basic Needs
                  </label>
                  <p className={styles.fieldHint}>
                    Are there basic expenses you currently cannot afford? Detail why they are necessary.
                  </p>
                  <textarea
                    id="unmetBasicNeeds"
                    className={styles.textarea}
                    value={form.unmetBasicNeeds}
                    onChange={(e) => update('unmetBasicNeeds', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Education & Hardship ─────────────────────────── */}
          {step === 5 && (
            <div key="s5" className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Education &amp; Case Narrative</h2>
              <div className={styles.fieldGroup}>
                <div className={styles.grid2}>
                  {numInput('totalDebt',       'Total Estimated Debt')}
                  {numInput('studentLoanDebt', 'Student Loan Debt')}
                </div>
                <div className={styles.field}>
                  <label htmlFor="schoolsHistory" className={styles.label}>
                    Schools Attended
                  </label>
                  <p className={styles.fieldHint}>
                    List all schools, graduation dates, and degrees received where you incurred student loan debt.
                  </p>
                  <textarea
                    id="schoolsHistory"
                    className={styles.textarea}
                    value={form.schoolsHistory}
                    onChange={(e) => update('schoolsHistory', e.target.value)}
                    placeholder={
                      'e.g. San Francisco State University — No Degree\n' +
                      '     Texas Southern University — B.S. Business (May 2020)…'
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="hardshipNotes" className={styles.label}>
                    Hardship Narrative
                  </label>
                  <p className={styles.fieldHint}>
                    Provide any additional information in support of your "undue hardship".
                  </p>
                  <textarea
                    id="hardshipNotes"
                    className={styles.textarea}
                    value={form.hardshipNotes}
                    onChange={(e) => update('hardshipNotes', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation ──────────────────────────────────────────────── */}
        <div className={styles.footer}>
          {step > 1 ? (
            <button id="intake-back" className={styles.btnBack}
              onClick={prev} disabled={isSubmitting} type="button">
              Back
            </button>
          ) : (
            <div className={styles.spacer} />
          )}

          {step < TOTAL_STEPS ? (
            <button id="intake-next" className={styles.btnNext}
              onClick={next} type="button">
              Next
            </button>
          ) : (
            <button id="intake-submit" className={styles.btnSubmit}
              onClick={handleSubmit} disabled={isSubmitting} type="button">
              {isSubmitting
                ? <><span className={styles.spinner} /> Submitting…</>
                : 'Submit Profile'}
            </button>
          )}
        </div>
      </div>

      <p className={styles.securityNote}>
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
