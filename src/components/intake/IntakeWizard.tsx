'use client';

// =============================================================================
// THE INDEPENDENCE LAW FIRM — CLIENT INTAKE WIZARD
// src/components/intake/IntakeWizard.tsx
//
// 7-step DOJ-aligned onboarding form. Collects all fields required for the
// undue-hardship determination and populates IntakeProfile on the backend.
// Submits through /api/intake (Next.js proxy) — the client_token HttpOnly
// cookie is read server-side so JS never touches it.
//
// Steps:
//   1 — Personal Information  (dob, ssn, county, phone, address)
//   2 — Household & Health    (householdSize, hasDisability)
//   3 — Employment & Income   (isEmployed, unemployed5of10, monthlyIncome)
//   4 — Assets                (housingStatus, hasCar, hasRetirement, expectingRefund)
//   5 — Monthly Expenses      (food, housing, transport, etc.)
//   6 — Education & Debt      (totalDebt, studentLoanDebt, schoolsHistory)
//   7 — Hardship Statement    (hardshipNotes, unmetBasicNeeds)
// =============================================================================

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './IntakeWizard.module.css';

// ── Step metadata ─────────────────────────────────────────────────────────────
const STEPS = [
  { number: 1, label: 'Personal',   icon: '👤' },
  { number: 2, label: 'Household',  icon: '🏠' },
  { number: 3, label: 'Employment', icon: '💼' },
  { number: 4, label: 'Assets',     icon: '📦' },
  { number: 5, label: 'Expenses',   icon: '📊' },
  { number: 6, label: 'Debt',       icon: '🎓' },
  { number: 7, label: 'Hardship',   icon: '✍️' },
] as const;

const TOTAL_STEPS = STEPS.length;

// ── Form state ────────────────────────────────────────────────────────────────
interface FormData {
  // Step 1 — Personal
  dob:     string;
  ssn:     string;
  county:  string;
  phone:   string;
  address: string;

  // Step 2 — Household & Health
  householdSize: string;
  hasDisability: boolean;

  // Step 3 — Employment & Income
  isEmployed:      boolean;
  unemployed5of10: boolean;
  monthlyIncome:   string;

  // Step 4 — Assets
  housingStatus:   string;
  hasCar:          boolean;
  hasRetirement:   boolean;
  expectingRefund: boolean;

  // Step 5 — Monthly Expenses
  expFood:         string;
  expHousekeeping: string;
  expApparel:      string;
  expPersonalCare: string;
  expHousing:      string;
  expUtilities:    string;
  expTransportGas: string;
  expCarInsurance: string;

  // Step 6 — Education & Debt
  totalDebt:       string;
  studentLoanDebt: string;
  schoolsHistory:  string;

  // Step 7 — Hardship
  hardshipNotes:   string;
  unmetBasicNeeds: string;
}

const INITIAL: FormData = {
  dob: '', ssn: '', county: '', phone: '', address: '',
  householdSize: '', hasDisability: false,
  isEmployed: false, unemployed5of10: false, monthlyIncome: '',
  housingStatus: '', hasCar: false, hasRetirement: false, expectingRefund: false,
  expFood: '', expHousekeeping: '', expApparel: '', expPersonalCare: '',
  expHousing: '', expUtilities: '', expTransportGas: '', expCarInsurance: '',
  totalDebt: '', studentLoanDebt: '', schoolsHistory: '',
  hardshipNotes: '', unmetBasicNeeds: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const toFloat = (s: string) => parseFloat(s) || 0;
const toInt   = (s: string) => parseInt(s, 10) || 0;

// ── Component ─────────────────────────────────────────────────────────────────
export default function IntakeWizard() {
  const router = useRouter();
  const [step, setStep]               = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]             = useState('');
  const [form, setForm]               = useState<FormData>(INITIAL);

  const set = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const next = () => { setError(''); setStep((s) => Math.min(s + 1, TOTAL_STEPS)); };
  const prev = () => { setError(''); setStep((s) => Math.max(s - 1, 1)); };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    const payload = {
      // Personal
      dob:     form.dob     || undefined,
      ssn:     form.ssn     || undefined,
      county:  form.county  || undefined,
      phone:   form.phone   || undefined,
      address: form.address || undefined,
      householdSize: toInt(form.householdSize),

      // Household & Health
      hasDisability: form.hasDisability,

      // Employment
      isEmployed:      form.isEmployed,
      unemployed5of10: form.unemployed5of10,
      monthlyIncome:   toFloat(form.monthlyIncome),

      // Assets
      housingStatus:   form.housingStatus || undefined,
      hasCar:          form.hasCar,
      hasRetirement:   form.hasRetirement,
      expectingRefund: form.expectingRefund,

      // Expenses
      expFood:         toFloat(form.expFood),
      expHousekeeping: toFloat(form.expHousekeeping),
      expApparel:      toFloat(form.expApparel),
      expPersonalCare: toFloat(form.expPersonalCare),
      expHousing:      toFloat(form.expHousing),
      expUtilities:    toFloat(form.expUtilities),
      expTransportGas: toFloat(form.expTransportGas),
      expCarInsurance: toFloat(form.expCarInsurance),

      // Debt
      totalDebt:       toFloat(form.totalDebt),
      studentLoanDebt: toFloat(form.studentLoanDebt),
      schoolsHistory:  form.schoolsHistory || undefined,

      // Hardship
      hardshipNotes:   form.hardshipNotes   || undefined,
      unmetBasicNeeds: form.unmetBasicNeeds || undefined,

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
        throw new Error((data as { error?: string }).error ?? 'Failed to save profile.');
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  const pct = ((step / TOTAL_STEPS) * 100).toFixed(0);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.headerEyebrow}>The Independence Law Firm</p>
        <h1 className={styles.headerTitle}>Client Intake Form</h1>
        <p className={styles.headerSubtitle}>
          Your information is protected by attorney-client privilege and
          256-bit encryption.
        </p>
      </header>

      <div className={styles.card}>
        {/* ── Progress header ─────────────────────────────────────────── */}
        <div className={styles.progressHeader}>
          <div className={styles.progressMeta}>
            <span className={styles.progressLabel}>Intake Progress</span>
            <span className={styles.progressCount}>Step {step} of {TOTAL_STEPS}</span>
          </div>
          <div className={styles.stepDots}>
            {STEPS.map((s) => (
              <span
                key={s.number}
                className={[
                  styles.dot,
                  step === s.number ? styles.active    : '',
                  step >  s.number  ? styles.completed : '',
                ].join(' ')}
              >
                <span className={styles.dotCircle}>
                  {step > s.number ? '✓' : s.number}
                </span>
                {s.label}
              </span>
            ))}
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

        {/* ── Step body ───────────────────────────────────────────────── */}
        <div className={styles.body}>
          {error && (
            <div className={styles.errorAlert} role="alert">
              <span className={styles.errorIcon}>⚠️</span>
              <span className={styles.errorText}>{error}</span>
            </div>
          )}

          {/* ── STEP 1: Personal Information ──────────────────────────── */}
          {step === 1 && (
            <div key="s1" className={styles.stepContent}>
              <div className={styles.stepIcon}>👤</div>
              <h2 className={styles.stepTitle}>Personal Information</h2>
              <p className={styles.stepDescription}>
                We need a few basic details to open your case file and
                determine which federal bankruptcy court has jurisdiction.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label htmlFor="dob" className={styles.label}>Date of Birth</label>
                    <input id="dob" type="text" className={styles.input}
                      value={form.dob} onChange={(e) => set('dob', e.target.value)}
                      placeholder="MM/DD/YYYY" autoComplete="bday" />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="ssn" className={styles.label}>
                      Social Security Number
                      <span className={styles.sensitiveTag}>🔒 Encrypted</span>
                    </label>
                    <input id="ssn" type="password" className={styles.input}
                      value={form.ssn} onChange={(e) => set('ssn', e.target.value)}
                      placeholder="XXX-XX-XXXX" autoComplete="off" />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label htmlFor="phone" className={styles.label}>Phone Number</label>
                    <input id="phone" type="tel" className={styles.input}
                      value={form.phone} onChange={(e) => set('phone', e.target.value)}
                      placeholder="(555) 555-5555" autoComplete="tel" />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="county" className={styles.label}>County of Residence</label>
                    <input id="county" type="text" className={styles.input}
                      value={form.county} onChange={(e) => set('county', e.target.value)}
                      placeholder="e.g. Cook County" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="address" className={styles.label}>Current Address</label>
                  <textarea id="address" className={styles.textarea} rows={2}
                    value={form.address} onChange={(e) => set('address', e.target.value)}
                    placeholder="123 Main St, City, State, ZIP"
                    autoComplete="street-address" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Household & Health ────────────────────────────── */}
          {step === 2 && (
            <div key="s2" className={styles.stepContent}>
              <div className={styles.stepIcon}>🏠</div>
              <h2 className={styles.stepTitle}>Household & Health</h2>
              <p className={styles.stepDescription}>
                Household size and disability status are key factors in the
                IRS means test used to determine bankruptcy eligibility.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label htmlFor="householdSize" className={styles.label}>
                    Number of People in Household
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputPrefix}>#</span>
                    <input id="householdSize" type="number" min="1" max="20"
                      className={styles.input}
                      value={form.householdSize}
                      onChange={(e) => set('householdSize', e.target.value)}
                      placeholder="1" />
                  </div>
                </div>
                <div className={styles.field}>
                  <span className={styles.label}>Disability Status</span>
                  <div className={styles.toggleGroup}>
                    <label className={styles.toggleOption}>
                      <input type="checkbox" className={styles.checkbox}
                        checked={form.hasDisability}
                        onChange={(e) => set('hasDisability', e.target.checked)} />
                      <span className={styles.toggleLabel}>
                        I have a documented disability or am unable to work due to a medical condition
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Employment & Income ───────────────────────────── */}
          {step === 3 && (
            <div key="s3" className={styles.stepContent}>
              <div className={styles.stepIcon}>💼</div>
              <h2 className={styles.stepTitle}>Employment & Income</h2>
              <p className={styles.stepDescription}>
                Employment history and current income determine which chapter
                of bankruptcy you qualify for and support the undue hardship
                standard under the Brunner test.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.toggleGroup}>
                  <label className={styles.toggleOption}>
                    <input type="checkbox" className={styles.checkbox}
                      checked={form.isEmployed}
                      onChange={(e) => set('isEmployed', e.target.checked)} />
                    <span className={styles.toggleLabel}>
                      I am currently employed (full-time, part-time, or self-employed)
                    </span>
                  </label>
                  <label className={styles.toggleOption}>
                    <input type="checkbox" className={styles.checkbox}
                      checked={form.unemployed5of10}
                      onChange={(e) => set('unemployed5of10', e.target.checked)} />
                    <span className={styles.toggleLabel}>
                      I have been unemployed for 5 or more of the past 10 years
                    </span>
                  </label>
                </div>
                <div className={styles.field}>
                  <label htmlFor="monthlyIncome" className={styles.label}>
                    Estimated Monthly Income (after tax)
                  </label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputPrefix}>$</span>
                    <input id="monthlyIncome" type="number" min="0" step="100"
                      className={styles.input}
                      value={form.monthlyIncome}
                      onChange={(e) => set('monthlyIncome', e.target.value)}
                      placeholder="0.00" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Assets ────────────────────────────────────────── */}
          {step === 4 && (
            <div key="s4" className={styles.stepContent}>
              <div className={styles.stepIcon}>📦</div>
              <h2 className={styles.stepTitle}>Assets & Property</h2>
              <p className={styles.stepDescription}>
                Asset disclosures are required for the bankruptcy petition.
                Exemptions exist for primary residences, basic vehicles, and
                retirement accounts in most states.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label htmlFor="housingStatus" className={styles.label}>
                    Housing Status
                  </label>
                  <select id="housingStatus" className={styles.select}
                    value={form.housingStatus}
                    onChange={(e) => set('housingStatus', e.target.value)}>
                    <option value="">Select…</option>
                    <option value="Own">I own my home</option>
                    <option value="Rent">I rent my home</option>
                  </select>
                </div>
                <div className={styles.toggleGroup}>
                  <label className={styles.toggleOption}>
                    <input type="checkbox" className={styles.checkbox}
                      checked={form.hasCar}
                      onChange={(e) => set('hasCar', e.target.checked)} />
                    <span className={styles.toggleLabel}>I own a vehicle</span>
                  </label>
                  <label className={styles.toggleOption}>
                    <input type="checkbox" className={styles.checkbox}
                      checked={form.hasRetirement}
                      onChange={(e) => set('hasRetirement', e.target.checked)} />
                    <span className={styles.toggleLabel}>
                      I have a retirement account (401k, IRA, pension)
                    </span>
                  </label>
                  <label className={styles.toggleOption}>
                    <input type="checkbox" className={styles.checkbox}
                      checked={form.expectingRefund}
                      onChange={(e) => set('expectingRefund', e.target.checked)} />
                    <span className={styles.toggleLabel}>
                      I am expecting a tax refund this year
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Monthly Expenses ──────────────────────────────── */}
          {step === 5 && (
            <div key="s5" className={styles.stepContent}>
              <div className={styles.stepIcon}>📊</div>
              <h2 className={styles.stepTitle}>Monthly Expenses</h2>
              <p className={styles.stepDescription}>
                The DOJ undue-hardship test requires itemized monthly expenses.
                Provide your best estimates — these can be refined later.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.expenseGrid}>
                  {[
                    ['expFood',         'Food & Groceries',   'expFood'],
                    ['expHousekeeping', 'Housekeeping',        'expHousekeeping'],
                    ['expApparel',      'Clothing & Apparel',  'expApparel'],
                    ['expPersonalCare', 'Personal Care',       'expPersonalCare'],
                    ['expHousing',      'Housing / Rent',      'expHousing'],
                    ['expUtilities',    'Utilities',           'expUtilities'],
                    ['expTransportGas', 'Gas / Transport',     'expTransportGas'],
                    ['expCarInsurance', 'Car Insurance',       'expCarInsurance'],
                  ].map(([field, label, htmlId]) => (
                    <div key={field} className={styles.expenseField}>
                      <label htmlFor={htmlId} className={styles.label}>{label}</label>
                      <div className={styles.inputWrapper}>
                        <span className={styles.inputPrefix}>$</span>
                        <input
                          id={htmlId}
                          type="number"
                          min="0"
                          step="10"
                          className={styles.input}
                          value={form[field as keyof FormData] as string}
                          onChange={(e) => set(field as keyof FormData, e.target.value as never)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 6: Education & Debt ──────────────────────────────── */}
          {step === 6 && (
            <div key="s6" className={styles.stepContent}>
              <div className={styles.stepIcon}>🎓</div>
              <h2 className={styles.stepTitle}>Education & Debt</h2>
              <p className={styles.stepDescription}>
                Student loans require special adversary proceedings. A complete
                education history helps us build the strongest possible undue
                hardship argument.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label htmlFor="totalDebt" className={styles.label}>
                      Estimated Total Debt
                    </label>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputPrefix}>$</span>
                      <input id="totalDebt" type="number" min="0" step="1000"
                        className={styles.input}
                        value={form.totalDebt}
                        onChange={(e) => set('totalDebt', e.target.value)}
                        placeholder="0.00" />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="studentLoanDebt" className={styles.label}>
                      Student Loan Debt
                    </label>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputPrefix}>$</span>
                      <input id="studentLoanDebt" type="number" min="0" step="1000"
                        className={styles.input}
                        value={form.studentLoanDebt}
                        onChange={(e) => set('studentLoanDebt', e.target.value)}
                        placeholder="0.00" />
                    </div>
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="schoolsHistory" className={styles.label}>
                    Schools Attended
                  </label>
                  <textarea id="schoolsHistory" className={styles.textarea}
                    value={form.schoolsHistory}
                    onChange={(e) => set('schoolsHistory', e.target.value)}
                    placeholder="School name, degree pursued, years attended&#10;e.g. State University, B.A. Business, 2010–2014&#10;     Community College, A.A. General Studies, 2008–2010" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 7: Hardship Statement ────────────────────────────── */}
          {step === 7 && (
            <div key="s7" className={styles.stepContent}>
              <div className={styles.stepIcon}>✍️</div>
              <h2 className={styles.stepTitle}>Your Hardship Statement</h2>
              <p className={styles.stepDescription}>
                These statements form the core of your undue hardship argument.
                Be specific — courts weigh medical diagnoses, job loss, family
                circumstances, and the gap between income and basic needs.
              </p>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label htmlFor="hardshipNotes" className={styles.label}>
                    What led you here? Describe your financial hardship.
                  </label>
                  <textarea id="hardshipNotes" className={styles.textarea}
                    value={form.hardshipNotes}
                    onChange={(e) => set('hardshipNotes', e.target.value)}
                    placeholder="E.g. After losing my position during the 2020 downturn, I was unable to maintain payments on $92,000 in federal loans despite working two part-time jobs. Wage garnishment has made it impossible to cover rent and groceries simultaneously…" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="unmetBasicNeeds" className={styles.label}>
                    What basic needs are you currently unable to meet?
                  </label>
                  <textarea id="unmetBasicNeeds" className={styles.textarea}
                    value={form.unmetBasicNeeds}
                    onChange={(e) => set('unmetBasicNeeds', e.target.value)}
                    placeholder="E.g. I cannot afford consistent groceries for my household of 3, am behind on rent by 2 months, and have delayed necessary medical treatment due to cost…" />
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
              ← Back
            </button>
          ) : (
            <div className={styles.spacer} />
          )}

          {step < TOTAL_STEPS ? (
            <button id="intake-next" className={styles.btnNext}
              onClick={next} type="button">
              Continue →
            </button>
          ) : (
            <button id="intake-submit" className={styles.btnSubmit}
              onClick={handleSubmit} disabled={isSubmitting} type="button">
              {isSubmitting ? (
                <><span className={styles.spinner} /> Submitting…</>
              ) : (
                'Submit Profile'
              )}
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
