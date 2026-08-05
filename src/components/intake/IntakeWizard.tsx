'use client';

// =============================================================================
// THE INDEPENDENCE LAW FIRM — CLIENT INTAKE WIZARD
// src/components/intake/IntakeWizard.tsx
//
// 5-step DOJ Student Loan Questionnaire.
//
// Migrated from CSS Modules → Tailwind CSS (Phase 2).
// =============================================================================

import { type FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import OnboardingPage from '@/app/onboarding/page';
import ExpenseStep, {
  type ExpenseFormData,
} from './steps/ExpenseStep';
import ReviewStep from './steps/ReviewStep';

const LEGACY_TOTAL_STEPS = 5;
const PUBLIC_TOTAL_STEPS = 5;
const PUBLIC_LAST_STEP = LEGACY_TOTAL_STEPS;
const MIN_PASSWORD_LENGTH = 8;
const PERSONAL_INFO_FORM_ID = 'personal-info-form';
const EXPENSE_FORM_ID = 'expense-form';

const accountSetupSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`),
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

interface IntakeWizardProps {
  token?: string;
  initialEmail?: string;
}

interface AccountSetupErrors {
  password?: string;
  confirmPassword?: string;
}

// ── Form state ────────────────────────────────────────────────────────────────
interface FormData {
  // Step 1
  firstName:      string;
  lastName:       string;
  email:          string;
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
  rentExpense:            number;
  medicalExpense:         number;
  utilitiesExpense:       number;
  homeMaintenanceExpense: number;
  carInsuranceExpense:    number;
  gasExpense:             number;
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
  firstName: '', lastName: '', email: '',
  dob: '', ssn: '', county: '', phone: '', address: '', householdSize: '0',
  hasDisability: false, isEmployed: false, unemployed5of10: false, hasCar: false,
  monthlyIncome: '',
  expFood: '', expHousekeeping: '', expApparel: '', expPersonalCare: '',
  rentExpense: 0, medicalExpense: 0, utilitiesExpense: 0,
  homeMaintenanceExpense: 0, carInsuranceExpense: 0, gasExpense: 0,
  expHousing: '', expUtilities: '', expTransportGas: '', expCarInsurance: '',
  unmetBasicNeeds: '',
  totalDebt: '', studentLoanDebt: '', schoolsHistory: '', hardshipNotes: '',
};

const pf = (s: string) => parseFloat(s) || 0;
const pi = (s: string) => parseInt(s, 10) || 0;
const householdSizeForBackend = (additionalMembers: string) => pi(additionalMembers) + 1;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  return z.string().email().safeParse(trimmed).success ? trimmed : '';
}

function extractBorrowerEmail(value: unknown): string {
  if (!isRecord(value)) return '';

  for (const key of ['email', 'borrowerEmail', 'clientEmail']) {
    const email = normalizeEmail(value[key]);
    if (email) return email;
  }

  for (const key of ['borrower', 'client', 'user', 'session']) {
    const nested = value[key];
    if (isRecord(nested)) {
      const email = extractBorrowerEmail(nested);
      if (email) return email;
    }
  }

  return '';
}

async function fetchCurrentBorrowerEmail(): Promise<string> {
  try {
    const sessionRes = await fetch('/api/public/auth/borrower-session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (sessionRes.ok) {
      const sessionData = await sessionRes.json().catch(() => ({}));
      const sessionEmail = extractBorrowerEmail(sessionData);
      if (sessionEmail) return sessionEmail;
    }

    const res = await fetch('/api/intake', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) return '';

    const data = await res.json().catch(() => ({}));
    return extractBorrowerEmail(data);
  } catch {
    return '';
  }
}

// ── Shared input class strings ────────────────────────────────────────────────
const inputCls =
  "w-full py-3.5 px-4 border-[1.5px] border-border rounded-md bg-white font-sans text-base text-text-primary transition-[border-color,box-shadow] duration-fast appearance-none placeholder:text-text-muted focus:outline-none focus:border-crimson focus:shadow-[0_0_0_3px_rgba(179,30,60,0.1)]";

const labelCls =
  "flex items-center gap-2 font-sans text-[0.8125rem] font-semibold text-text-secondary tracking-[0.06em] uppercase";

// ── Component ─────────────────────────────────────────────────────────────────
export default function IntakeWizard({ token = '', initialEmail = '' }: IntakeWizardProps) {
  const router = useRouter();
  const uid = useId();
  const inviteToken = token.trim();
  const seededEmail = normalizeEmail(initialEmail);
  const isPublicInviteFlow = inviteToken.length > 0;
  const [currentStep, setCurrentStep] = useState(() => (isPublicInviteFlow ? 0 : 1));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]             = useState('');
  const [form, setForm]               = useState<FormData>(() => ({
    ...INITIAL,
    email: seededEmail,
  }));
  const [password, setPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountErrors, setAccountErrors] = useState<AccountSetupErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const step = currentStep;

  const update = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    [],
  );

  // ── Hydrate email from invitation token on mount ──────────────────────────
  useEffect(() => {
    if (!inviteToken) return;

    let cancelled = false;

    fetch(`/api/auth/invite/verify?token=${encodeURIComponent(inviteToken)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.valid && typeof data.email === 'string') {
          setForm((prev) => ({ ...prev, email: data.email }));
        }
      })
      .catch(() => {
        // Silently ignore — email will be resolved later from session
      });

    return () => { cancelled = true; };
  }, [inviteToken]);

  const next = () => {
    setError('');
    setCurrentStep((s) => Math.min(s + 1, isPublicInviteFlow ? PUBLIC_LAST_STEP : LEGACY_TOTAL_STEPS));
  };

  const prev = () => {
    setError('');
    setCurrentStep((s) => Math.max(s - 1, isPublicInviteFlow ? 0 : 1));
  };

  const handleAccountSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = accountSetupSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setAccountErrors({
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0],
      });
      return;
    }

    setAccountErrors({});
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/public/auth/intake/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteToken,
          password: parsed.data.password,
        }),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          typeof data.message === 'string' ? data.message :
          typeof data.error === 'string' ? data.error :
          'Unable to set up your account. Please try again.';
        throw new Error(message);
      }

      const setupEmail =
        extractBorrowerEmail(data) || await fetchCurrentBorrowerEmail();
      if (setupEmail) {
        setForm((prev) => ({ ...prev, email: setupEmail }));
      }

      setPassword('');
      setConfirmPassword('');
      setCurrentStep(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to set up your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isPublicInviteFlow || currentStep > 0) {
    return <OnboardingPage initialEmail={form.email || seededEmail} />;
  }

  const savePersonalHouseholdInfo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const payload = {
      dob: form.dob || undefined,
      ssn: form.ssn || undefined,
      address: form.address || undefined,
      county: form.county || undefined,
      phone: form.phone || undefined,
      householdSize: householdSizeForBackend(form.householdSize),
    };

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message =
          typeof data.message === 'string' ? data.message :
          typeof data.error === 'string' ? data.error :
          'Failed to save your personal information.';
        throw new Error(message);
      }

      next();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save your personal information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExpenseNext = (data: ExpenseFormData) => {
    setForm((prev) => ({
      ...prev,
      ...data,
      expHousing: String(data.rentExpense),
      expUtilities: String(data.utilitiesExpense),
      expTransportGas: String(data.gasExpense),
      expCarInsurance: String(data.carInsuranceExpense),
    }));
    next();
  };

  const submitIntake = async () => {
    setIsSubmitting(true);
    setError('');

    const payload = {
      firstName: form.firstName || undefined,
      lastName:  form.lastName  || undefined,
      email:     form.email     || undefined,
      dob:     form.dob     || undefined,
      ssn:     form.ssn     || undefined,
      county:  form.county  || undefined,
      phone:   form.phone   || undefined,
      address: form.address || undefined,
      householdSize:   householdSizeForBackend(form.householdSize),
      hasDisability:   form.hasDisability,
      isEmployed:      form.isEmployed,
      unemployed5of10: form.unemployed5of10,
      hasCar:          form.hasCar,
      monthlyIncome:   pf(form.monthlyIncome),
      expFood:         pf(form.expFood),
      expHousekeeping: pf(form.expHousekeeping),
      expApparel:      pf(form.expApparel),
      expPersonalCare: pf(form.expPersonalCare),
      rentExpense: form.rentExpense,
      medicalExpense: form.medicalExpense,
      utilitiesExpense: form.utilitiesExpense,
      homeMaintenanceExpense: form.homeMaintenanceExpense,
      carInsuranceExpense: form.carInsuranceExpense,
      gasExpense: form.gasExpense,
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
      const res = await fetch('/api/intake/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to submit intake profile.');
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const isAccountSetupStep = isPublicInviteFlow && currentStep === 0;
  const displayedStep = isPublicInviteFlow ? Math.max(currentStep, 1) : currentStep;
  const displayedTotalSteps = isPublicInviteFlow ? PUBLIC_TOTAL_STEPS : LEGACY_TOTAL_STEPS;
  const pct = ((displayedStep / displayedTotalSteps) * 100).toFixed(0);

  // ── Input helpers ─────────────────────────────────────────────────────────
  const textInput = (id: keyof FormData, label: string, opts?: {
    type?: string; placeholder?: string; colSpan?: boolean;
  }) => (
    <div className={opts?.colSpan ? 'col-span-full' : undefined}>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input
        id={id}
        name={id}
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
          name={id}
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

  const yesNoRow = (id: keyof FormData, label: string) => (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-border last:border-0 max-[540px]:flex-col max-[540px]:gap-2">
      <label htmlFor={id} className="text-[0.9375rem] text-text-primary leading-[1.5] cursor-pointer">
        {label}
      </label>
      <div className="relative shrink-0">
        <select
          id={id}
          name={id}
          className="w-32 py-2.5 px-3 border-[1.5px] border-border rounded-md bg-white font-sans text-[0.9375rem] text-text-primary transition-[border-color,box-shadow] duration-fast appearance-none focus:outline-none focus:border-crimson focus:shadow-[0_0_0_3px_rgba(179,30,60,0.1)]"
          value={(form[id] as boolean) ? 'Yes' : 'No'}
          onChange={(e) => update(id, (e.target.value === 'Yes') as never)}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
    </div>
  );

  const personalHouseholdStep = (
    <form
      id={PERSONAL_INFO_FORM_ID}
      onSubmit={savePersonalHouseholdInfo}
      noValidate
      className="min-h-[280px] animate-[stepEnter_0.35s_cubic-bezier(0.4,0,0.2,1)_both]"
    >
      <div className="mb-6">
        <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-2">
          Step 1
        </p>
        <h2 className="font-serif text-[1.5rem] text-navy mb-2">
          Personal &amp; Household Information
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-5 max-[540px]:grid-cols-1">
        {textInput('dob', 'Date of Birth', { placeholder: 'MM/DD/YYYY' })}
        {textInput('ssn', 'Social Security Number', { type: 'password', placeholder: 'XXX-XX-XXXX' })}
        {textInput('address', 'Full Address', { colSpan: true, placeholder: '123 Main St, City, State, ZIP' })}
        {textInput('county', 'County')}
        {textInput('phone', 'Phone Number', { type: 'tel', placeholder: '(555) 555-5555' })}
        <div>
          <label htmlFor="householdSize" className={labelCls}>
            Additional Household Members
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-base text-text-muted font-medium pointer-events-none">#</span>
            <input
              id="householdSize"
              name="householdSize"
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
    </form>
  );

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-start pt-10 px-4 pb-16">
      <header className="text-center mb-8">
        <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-2">
          Liberty
        </p>
        <h1 className="font-serif text-[clamp(1.5rem,3vw,2.25rem)] text-navy mb-2">
          {isPublicInviteFlow ? 'Borrower Intake' : 'DOJ Student Loan Questionnaire'}
        </h1>
        <p className="text-[0.9375rem] text-text-muted max-w-[440px] mx-auto">
          {isPublicInviteFlow
            ? isAccountSetupStep
              ? 'First, create a permanent password so you can return to your portal without the email link.'
              : 'Your information is protected by attorney-client privilege and 256-bit encryption.'
            : 'Your information is protected by attorney-client privilege and 256-bit encryption.'}
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
              {isAccountSetupStep ? 'Account Setup' : `Step ${displayedStep} of ${displayedTotalSteps}`}
            </span>
          </div>
          <div className="h-[3px] bg-white/[0.12] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-crimson to-[#e05275] rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-[0_0_8px_rgba(179,30,60,0.5)]"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={displayedStep}
              aria-valuemin={1}
              aria-valuemax={displayedTotalSteps}
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
          {isPublicInviteFlow ? (
            <>
              {currentStep === 0 && (
                <form
                  id="account-setup-form"
                  onSubmit={handleAccountSetup}
                  noValidate
                  className="min-h-[280px] animate-step-enter"
                >
                  <div className="mb-6">
                    <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-2">
                      Account Setup
                    </p>
                    <h2 className="font-serif text-[1.5rem] text-navy mb-2">
                      Create Your Password
                    </h2>
                    <p className="text-[0.9375rem] text-text-muted leading-relaxed">
                      Your email address is your username. Choose a password you can use for future portal logins.
                    </p>
                  </div>

                  {/* Email (locked — hydrated from invitation token) */}
                  <div className="flex flex-col gap-2 mb-1">
                    <label htmlFor={`${uid}-email`} className={labelCls}>
                      Email Address
                    </label>
                    <input
                      id={`${uid}-email`}
                      name="email"
                      type="email"
                      autoComplete="email"
                      className={`${inputCls} bg-gray-50 text-text-muted cursor-not-allowed`}
                      value={form.email}
                      disabled
                      readOnly
                    />
                    <p className="text-[0.8125rem] text-text-muted">
                      Your email address is your username and cannot be changed.
                    </p>
                  </div>

                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <label htmlFor={`${uid}-password`} className={labelCls}>
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id={`${uid}-password`}
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          className={`${inputCls} pr-20 ${accountErrors.password ? 'border-error focus:border-error' : ''}`}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (accountErrors.password) {
                              setAccountErrors((prev) => ({ ...prev, password: undefined }));
                            }
                          }}
                          aria-invalid={!!accountErrors.password}
                          aria-describedby={accountErrors.password ? `${uid}-password-error` : `${uid}-password-hint`}
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-navy hover:text-crimson disabled:opacity-50"
                          onClick={() => setShowPassword((value) => !value)}
                          disabled={isSubmitting}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {accountErrors.password ? (
                        <span id={`${uid}-password-error`} className="text-[0.8125rem] text-error" role="alert">
                          {accountErrors.password}
                        </span>
                      ) : (
                        <span id={`${uid}-password-hint`} className="text-[0.8125rem] text-text-muted">
                          Minimum {MIN_PASSWORD_LENGTH} characters.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor={`${uid}-confirm-password`} className={labelCls}>
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          id={`${uid}-confirm-password`}
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          className={`${inputCls} pr-20 ${accountErrors.confirmPassword ? 'border-error focus:border-error' : ''}`}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (accountErrors.confirmPassword) {
                              setAccountErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                            }
                          }}
                          aria-invalid={!!accountErrors.confirmPassword}
                          aria-describedby={accountErrors.confirmPassword ? `${uid}-confirm-password-error` : undefined}
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-navy hover:text-crimson disabled:opacity-50"
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          disabled={isSubmitting}
                          aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                        >
                          {showConfirmPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {accountErrors.confirmPassword && (
                        <span id={`${uid}-confirm-password-error`} className="text-[0.8125rem] text-error" role="alert">
                          {accountErrors.confirmPassword}
                        </span>
                      )}
                    </div>
                  </div>
                </form>
              )}

              {currentStep === 1 && (
                personalHouseholdStep
              )}

              {currentStep === 2 && (
                <div key="public-s2" className="min-h-[280px] animate-[stepEnter_0.35s_cubic-bezier(0.4,0,0.2,1)_both]">
                  <div className="mb-6">
                    <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-2">
                      Step 2
                    </p>
                    <h2 className="font-serif text-[1.5rem] text-navy mb-2">Health, Employment &amp; Assets</h2>
                  </div>
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col mb-2 rounded-md border border-border bg-white px-4 py-2">
                      {yesNoRow('hasDisability',   'Do you have a disability or chronic injury impacting income potential?')}
                      {yesNoRow('isEmployed',       'Are you currently employed?')}
                      {yesNoRow('unemployed5of10',  'Have you been unemployed for at least 5 of the last 10 years?')}
                      {yesNoRow('hasCar',           'Do you own a vehicle?')}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="monthlyIncome" className={labelCls}>
                        Gross Monthly Income ($)
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-base text-text-muted font-medium pointer-events-none">$</span>
                        <input
                          id="monthlyIncome"
                          name="monthlyIncome"
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

              {currentStep === 3 && (
                <div key="public-s3" className="min-h-[280px] animate-[stepEnter_0.35s_cubic-bezier(0.4,0,0.2,1)_both]">
                  <div className="mb-6">
                    <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-2">
                      Step 3
                    </p>
                    <h2 className="font-serif text-[1.5rem] text-navy mb-2">Average Monthly Expenses</h2>
                    <p className="text-sm text-text-muted leading-relaxed py-3 px-4 bg-bg rounded-md border-l-[3px] border-crimson-light">
                      Enter 0 if an expense does not apply to you.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-5 max-[540px]:grid-cols-1">
                    {numInput('expFood',         'Food')}
                    {numInput('expHousekeeping', 'Housekeeping Supplies')}
                    {numInput('expApparel',      'Apparel & Services')}
                    {numInput('expPersonalCare', 'Personal Care Products')}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <ExpenseStep
                  formId={EXPENSE_FORM_ID}
                  defaultValues={{
                    rentExpense: form.rentExpense,
                    medicalExpense: form.medicalExpense,
                    utilitiesExpense: form.utilitiesExpense,
                    homeMaintenanceExpense: form.homeMaintenanceExpense,
                    carInsuranceExpense: form.carInsuranceExpense,
                    gasExpense: form.gasExpense,
                  }}
                  onSubmit={handleExpenseNext}
                />
              )}

              {currentStep === 5 && (
                <ReviewStep wizardState={form} />
              )}
            </>
          ) : (
            <>
          {step === 1 && (
            personalHouseholdStep
          )}

          {/* ── STEP 2: Health, Employment & Assets ───────────────────── */}
          {step === 2 && (
            <div key="s2" className="min-h-[280px] animate-[stepEnter_0.35s_cubic-bezier(0.4,0,0.2,1)_both]">
              <h2 className="font-serif text-[1.375rem] text-navy mb-2">Health, Employment &amp; Assets</h2>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col mb-2 rounded-md border border-border bg-white px-4 py-2">
                  {yesNoRow('hasDisability',   'Do you have a disability or chronic injury impacting income potential?')}
                  {yesNoRow('isEmployed',       'Are you currently employed?')}
                  {yesNoRow('unemployed5of10',  'Have you been unemployed for at least 5 of the last 10 years?')}
                  {yesNoRow('hasCar',           'Do you own a vehicle?')}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="monthlyIncome" className={labelCls}>
                    Gross Monthly Income ($)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-base text-text-muted font-medium pointer-events-none">$</span>
                    <input
                      id="monthlyIncome"
                      name="monthlyIncome"
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
            <ExpenseStep
              formId={EXPENSE_FORM_ID}
              defaultValues={{
                rentExpense: form.rentExpense,
                medicalExpense: form.medicalExpense,
                utilitiesExpense: form.utilitiesExpense,
                homeMaintenanceExpense: form.homeMaintenanceExpense,
                carInsuranceExpense: form.carInsuranceExpense,
                gasExpense: form.gasExpense,
              }}
              onSubmit={handleExpenseNext}
            />
          )}

          {/* ── STEP 5: Review & Submit ──────────────────────────────── */}
          {step === 5 && (
            <ReviewStep wizardState={form} />
          )}
            </>
          )}
        </div>

        {/* ── Navigation ──────────────────────────────────────────────── */}
        <div className="flex justify-between items-center py-5 px-8 max-[680px]:py-4 max-[680px]:px-5 border-t border-border gap-4">
          {isPublicInviteFlow ? (
            <>
              {currentStep > 0 ? (
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

              {currentStep === 0 ? (
                <button
                  id="intake-account-setup-submit"
                  form="account-setup-form"
                  className="inline-flex items-center gap-2 py-3 px-7 bg-crimson border-none rounded-md font-sans text-[0.9375rem] font-semibold text-white cursor-pointer transition-all duration-fast shadow-[0_2px_8px_rgba(179,30,60,0.35)] hover:bg-crimson-hover hover:shadow-[0_4px_16px_rgba(179,30,60,0.45)] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting
                    ? <><span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin shrink-0" /> Setting up...</>
                    : 'Create Password'}
                </button>
              ) : currentStep < PUBLIC_LAST_STEP ? (
                <button
                  id="intake-next"
                  form={
                    currentStep === 1
                      ? PERSONAL_INFO_FORM_ID
                      : currentStep === 4
                        ? EXPENSE_FORM_ID
                        : undefined
                  }
                  className="inline-flex items-center gap-2 py-3 px-7 bg-navy border-none rounded-md font-sans text-[0.9375rem] font-semibold text-white cursor-pointer transition-all duration-fast shadow-sm hover:bg-navy-hover hover:shadow-md hover:-translate-y-px"
                  onClick={currentStep === 1 || currentStep === 4 ? undefined : next}
                  type={currentStep === 1 || currentStep === 4 ? 'submit' : 'button'}
                  disabled={isSubmitting}
                >
                  {isSubmitting && currentStep === 1 ? 'Saving...' : 'Next'}
                </button>
              ) : (
                <button
                  id="intake-finish"
                  className="inline-flex items-center gap-2 py-3 px-7 bg-crimson border-none rounded-md font-sans text-[0.9375rem] font-semibold text-white cursor-pointer transition-all duration-fast shadow-[0_2px_8px_rgba(179,30,60,0.35)] hover:bg-crimson-hover hover:shadow-[0_4px_16px_rgba(179,30,60,0.45)] hover:-translate-y-px"
                  onClick={submitIntake}
                  disabled={isSubmitting}
                  type="button"
                >
                  {isSubmitting
                    ? <><span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin shrink-0" /> Submitting...</>
                    : 'Submit Application'}
                </button>
              )}
            </>
          ) : (
            <>
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

          {step < LEGACY_TOTAL_STEPS ? (
            <button
              id="intake-next"
              form={step === 1 ? PERSONAL_INFO_FORM_ID : step === 4 ? EXPENSE_FORM_ID : undefined}
              className="inline-flex items-center gap-2 py-3 px-7 bg-navy border-none rounded-md font-sans text-[0.9375rem] font-semibold text-white cursor-pointer transition-all duration-fast shadow-sm hover:bg-navy-hover hover:shadow-md hover:-translate-y-px"
              onClick={step === 1 || step === 4 ? undefined : next}
              type={step === 1 || step === 4 ? 'submit' : 'button'}
              disabled={isSubmitting}
            >
              {isSubmitting && step === 1 ? 'Saving...' : 'Next'}
            </button>
          ) : (
            <button
              id="intake-submit"
              className="inline-flex items-center gap-2 py-3 px-7 bg-crimson border-none rounded-md font-sans text-[0.9375rem] font-semibold text-white cursor-pointer transition-all duration-fast shadow-[0_2px_8px_rgba(179,30,60,0.35)] hover:bg-crimson-hover hover:shadow-[0_4px_16px_rgba(179,30,60,0.45)] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              onClick={submitIntake}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting
                ? <><span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin shrink-0" /> Submitting…</>
                : 'Submit Application'}
            </button>
          )}
            </>
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
