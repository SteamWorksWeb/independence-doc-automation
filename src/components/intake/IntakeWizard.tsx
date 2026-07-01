'use client';

// =============================================================================
// THE INDEPENDENCE LAW FIRM — CLIENT INTAKE WIZARD
// src/components/intake/IntakeWizard.tsx
//
// Multi-step onboarding form. Collects the data that populates IntakeProfile
// on the backend. Submits through the /api/intake Next.js proxy route so the
// HttpOnly client_token cookie can be read server-side.
//
// Steps:
//   1 — Contact Information  (phone, address)
//   2 — Financial Snapshot   (employment, monthly income)
//   3 — Debt Profile         (total debt, student loan debt, loan types)
//   4 — Your Hardship        (hardship narrative)
// =============================================================================

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './IntakeWizard.module.css';

// ── Step metadata ─────────────────────────────────────────────────────────────
const STEPS = [
  { number: 1, label: 'Contact',   icon: '📋' },
  { number: 2, label: 'Financial', icon: '💼' },
  { number: 3, label: 'Debt',      icon: '📊' },
  { number: 4, label: 'Hardship',  icon: '✍️' },
] as const;

const TOTAL_STEPS = STEPS.length;

// ── Form state shape ──────────────────────────────────────────────────────────
interface FormData {
  phone:            string;
  address:          string;
  employmentStatus: string;
  monthlyIncome:    string;
  totalDebt:        string;
  studentLoanDebt:  string;
  loanTypes:        string;
  hardshipNotes:    string;
}

const INITIAL_FORM: FormData = {
  phone:            '',
  address:          '',
  employmentStatus: '',
  monthlyIncome:    '',
  totalDebt:        '',
  studentLoanDebt:  '',
  loanTypes:        '',
  hardshipNotes:    '',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function IntakeWizard() {
  const router = useRouter();
  const [step, setStep]             = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [formData, setFormData]     = useState<FormData>(INITIAL_FORM);

  // ── Field updater ─────────────────────────────────────────────────────────
  const update = useCallback(<K extends keyof FormData>(field: K, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const next = () => {
    setError('');
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const prev = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1));
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    // Parse numeric fields — default to 0 if blank
    const payload = {
      ...formData,
      monthlyIncome:   parseFloat(formData.monthlyIncome)   || 0,
      totalDebt:       parseFloat(formData.totalDebt)       || 0,
      studentLoanDebt: parseFloat(formData.studentLoanDebt) || 0,
      isCompleted: true,
    };

    try {
      // ── Call the Next.js proxy — NOT the Render backend directly.
      //    The proxy reads the HttpOnly client_token cookie server-side
      //    and attaches it as a Bearer token.
      const res = await fetch('/api/intake', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to save profile. Please try again.');
      }

      // Intake complete — redirect to the client dashboard
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      setIsSubmitting(false);
    }
  };

  const progressPct = ((step / TOTAL_STEPS) * 100).toFixed(0);

  return (
    <div className={styles.shell}>
      {/* Brand header */}
      <header className={styles.header}>
        <p className={styles.headerEyebrow}>The Independence Law Firm</p>
        <h1 className={styles.headerTitle}>Client Intake Form</h1>
        <p className={styles.headerSubtitle}>
          Your information is protected by attorney-client privilege and
          256-bit encryption.
        </p>
      </header>

      <div className={styles.card}>
        {/* ── Progress header ────────────────────────────────────────────── */}
        <div className={styles.progressHeader}>
          <div className={styles.progressMeta}>
            <span className={styles.progressLabel}>Intake Progress</span>
            <span className={styles.progressCount}>Step {step} of {TOTAL_STEPS}</span>
          </div>

          {/* Step dots */}
          <div className={styles.stepDots}>
            {STEPS.map((s) => (
              <span
                key={s.number}
                className={[
                  styles.dot,
                  step === s.number ? styles.active : '',
                  step > s.number  ? styles.completed : '',
                ].join(' ')}
              >
                <span className={styles.dotCircle}>
                  {step > s.number ? '✓' : s.number}
                </span>
                {s.label}
              </span>
            ))}
          </div>

          {/* Progress bar */}
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
            />
          </div>
        </div>

        {/* ── Step content ───────────────────────────────────────────────── */}
        <div className={styles.body}>
          {error && (
            <div className={styles.errorAlert} role="alert">
              <span className={styles.errorIcon}>⚠️</span>
              <span className={styles.errorText}>{error}</span>
            </div>
          )}

          {/* STEP 1 — Contact Information */}
          {step === 1 && (
            <div key="step-1" className={styles.stepContent}>
              <div className={styles.stepIcon}>📋</div>
              <h2 className={styles.stepTitle}>Contact Information</h2>
              <p className={styles.stepDescription}>
                We need a valid address to determine which federal bankruptcy
                court has jurisdiction over your case.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label htmlFor="intake-phone" className={styles.label}>
                    Phone Number
                  </label>
                  <input
                    id="intake-phone"
                    type="tel"
                    className={styles.input}
                    value={formData.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="(555) 555-5555"
                    autoComplete="tel"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="intake-address" className={styles.label}>
                    Current Address
                  </label>
                  <textarea
                    id="intake-address"
                    className={styles.textarea}
                    value={formData.address}
                    onChange={(e) => update('address', e.target.value)}
                    placeholder="123 Main St, City, State, ZIP"
                    rows={3}
                    autoComplete="street-address"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — Financial Snapshot */}
          {step === 2 && (
            <div key="step-2" className={styles.stepContent}>
              <div className={styles.stepIcon}>💼</div>
              <h2 className={styles.stepTitle}>Financial Snapshot</h2>
              <p className={styles.stepDescription}>
                Your income and employment status help us determine eligibility
                for Chapter 7 (liquidation) vs. Chapter 13 (repayment plan)
                bankruptcy.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label htmlFor="intake-employment" className={styles.label}>
                    Employment Status
                  </label>
                  <select
                    id="intake-employment"
                    className={styles.select}
                    value={formData.employmentStatus}
                    onChange={(e) => update('employmentStatus', e.target.value)}
                  >
                    <option value="">Select your status…</option>
                    <option value="Employed">Employed (Full-time or Part-time)</option>
                    <option value="Self-Employed">Self-Employed / Freelance</option>
                    <option value="Unemployed">Currently Unemployed</option>
                    <option value="Retired">Retired</option>
                    <option value="Disabled">Disabled / Unable to Work</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="intake-income" className={styles.label}>
                    Estimated Monthly Income
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputPrefix}>$</span>
                    <input
                      id="intake-income"
                      type="number"
                      min="0"
                      step="100"
                      className={styles.input}
                      value={formData.monthlyIncome}
                      onChange={(e) => update('monthlyIncome', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Debt Profile */}
          {step === 3 && (
            <div key="step-3" className={styles.stepContent}>
              <div className={styles.stepIcon}>📊</div>
              <h2 className={styles.stepTitle}>Debt Profile</h2>
              <p className={styles.stepDescription}>
                Student loans require special adversary proceedings in
                bankruptcy. Identifying your loan types lets us map the
                correct legal strategy for discharge.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label htmlFor="intake-total-debt" className={styles.label}>
                    Estimated Total Debt
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputPrefix}>$</span>
                    <input
                      id="intake-total-debt"
                      type="number"
                      min="0"
                      step="1000"
                      className={styles.input}
                      value={formData.totalDebt}
                      onChange={(e) => update('totalDebt', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="intake-student-debt" className={styles.label}>
                    Student Loan Debt
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputPrefix}>$</span>
                    <input
                      id="intake-student-debt"
                      type="number"
                      min="0"
                      step="1000"
                      className={styles.input}
                      value={formData.studentLoanDebt}
                      onChange={(e) => update('studentLoanDebt', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="intake-loan-types" className={styles.label}>
                    Student Loan Types
                  </label>
                  <select
                    id="intake-loan-types"
                    className={styles.select}
                    value={formData.loanTypes}
                    onChange={(e) => update('loanTypes', e.target.value)}
                  >
                    <option value="">Select loan types…</option>
                    <option value="Federal">Federal Loans Only</option>
                    <option value="Private">Private Loans Only</option>
                    <option value="Both">Both Federal and Private</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Your Hardship */}
          {step === 4 && (
            <div key="step-4" className={styles.stepContent}>
              <div className={styles.stepIcon}>✍️</div>
              <h2 className={styles.stepTitle}>Your Hardship Statement</h2>
              <p className={styles.stepDescription}>
                In your own words, describe what led you to seek relief and
                what you hope to achieve. This becomes part of your undue
                hardship argument — the more specific, the stronger your case.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label htmlFor="intake-hardship" className={styles.label}>
                    Hardship Narrative
                  </label>
                  <textarea
                    id="intake-hardship"
                    className={styles.textarea}
                    value={formData.hardshipNotes}
                    onChange={(e) => update('hardshipNotes', e.target.value)}
                    placeholder="E.g., After losing my position during the 2020 downturn, I was unable to maintain payments on $92,000 in federal loans despite working two part-time jobs. Wage garnishment has made it impossible to cover basic living expenses…"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation footer ──────────────────────────────────────────── */}
        <div className={styles.footer}>
          {step > 1 ? (
            <button
              id="intake-back"
              className={styles.btnBack}
              onClick={prev}
              disabled={isSubmitting}
              type="button"
            >
              ← Back
            </button>
          ) : (
            <div className={styles.spacer} />
          )}

          {step < TOTAL_STEPS ? (
            <button
              id="intake-next"
              className={styles.btnNext}
              onClick={next}
              type="button"
            >
              Continue →
            </button>
          ) : (
            <button
              id="intake-submit"
              className={styles.btnSubmit}
              onClick={handleSubmit}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <span className={styles.spinner} />
                  Submitting…
                </>
              ) : (
                'Submit Profile'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Security footnote */}
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
