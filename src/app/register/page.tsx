"use client";

import { Suspense } from "react";

/**
 * src/app/register/page.tsx
 *
 * Standalone Client Registration page ΓÇö /register
 *
 * Layout: Two-column (brand panel left, form right) ΓÇö collapses to single
 * column on mobile, matching the portal's existing auth gateway page.
 *
 * State machine:
 *   "idle"    ΓÇö form ready for input
 *   "loading" ΓÇö Server Action in flight
 *   "pending" ΓÇö 201 success, verification email sent
 *
 * The form collects: Email (locked, pre-populated from invitation token), Password,
 * and Confirm Password. Name is derived from the email prefix by the server action.
 */

import { useState, useCallback, useEffect, useId, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Metadata } from "next";
import { registerClient } from "@/actions/registerClient";
import styles from "./register.module.css";

// Note: Metadata export cannot co-exist with "use client" in the same file.
// Move this to a layout.tsx or a server wrapper if you need per-page metadata.
// For now, the root layout.tsx title template handles it.

// ΓöÇΓöÇ Types ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

type PageState = "idle" | "loading" | "pending";

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

// ΓöÇΓöÇ Validation (client-side mirror of server action validation) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFields(email: string, password: string, confirmPassword: string): FieldErrors {
  const err: FieldErrors = {};
  if (!email.trim()) err.email = "Email address is required.";
  else if (!EMAIL_RE.test(email.trim())) err.email = "Please enter a valid email address.";
  if (!password) err.password = "Password is required.";
  else if (password.length < 8) err.password = "Password must be at least 8 characters.";
  if (password && confirmPassword !== password) err.confirmPassword = "Passwords do not match.";
  return err;
}

// ΓöÇΓöÇ Password strength ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { level: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { level: 1, label: "Weak" };
  if (s === 2) return { level: 2, label: "Fair" };
  return { level: 3, label: "Strong" };
}

// ΓöÇΓöÇ Icons ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={styles.alertIcon}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ScalesIcon({ size }: { size?: number }) { return <img src="/logo.png" alt="Liberty Logo" style={{ width: "100%", height: "auto", minWidth: "140px", maxWidth: "220px", objectFit: "contain" }} /> }

function LockIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ΓöÇΓöÇ Main Component ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

// Wrapper component to provide Suspense boundary for useSearchParams
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const uid = useId();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form fields
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);

  // UI state
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errors, setErrors]       = useState<FieldErrors>({});
  const [registeredEmail, setRegisteredEmail] = useState("");

  const isLoading = pageState === "loading" || isPending;

  const strength = passwordStrength(password);

  // ΓöÇΓöÇ Hydrate email from invitation token on mount ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetch(`/api/auth/invite/verify?token=${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.valid && typeof data.email === "string") {
          setEmail(data.email);
        }
      })
      .catch(() => {
        // Silently ignore ΓÇö user can still submit; backend validates token + email match
      });

    return () => { cancelled = true; };
  }, [token]);

  // ΓöÇΓöÇ Handle Submit ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Client-side validation first
      const fieldErrors = validateFields(email, password, confirmPassword);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }

      setErrors({});
      setPageState("loading");

      // Derive a display name from the email prefix (backend also does this as fallback)
      const derivedName = email
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() || email;

      startTransition(async () => {
        const result = await registerClient({ name: derivedName, email, password, token: token || undefined });

        if (result.ok) {
          if (result.tokenized) {
            // Invite-token flow: account is already verified — go straight to onboarding.
            router.push("/onboarding");
          } else {
            // Self-registration: show "check your email" pending screen.
            setRegisteredEmail(result.email);
            setPageState("pending");
          }
        } else {
          setPageState("idle");

          if (result.code === "DUPLICATE_EMAIL") {
            setErrors({ email: result.message });
          } else if (result.code === "INVALID_TOKEN") {
            setErrors({ general: result.message });
          } else if (result.code === "VALIDATION") {
            setErrors({ general: result.message });
          } else {
            setErrors({ general: result.message });
          }
        }
      });
    },
    [email, password, confirmPassword, token]
  );

  // ——————————————————————————————————————————————————————————————————————————————————————
  if (pageState === "pending") {
    return (
      <main className={styles.root}>
        <aside className={`${styles.brandPanel} flex items-center justify-center`} aria-label="Firm information">
          <div className={styles.brandLogo}>
            <ScalesIcon />
          </div>
        </aside>

        <section className={styles.formPanel} aria-label="Account created">
          <div className={styles.formInner}>
            <div className={styles.card}>
              <div className={styles.pendingCard}>
                <div className={styles.pendingIconWrap}>
                  <MailIcon />
                </div>
                <h1 className={styles.pendingTitle}>Check Your Inbox</h1>
                <p className={styles.pendingDesc}>
                  We sent a verification link to
                </p>
                <p className={styles.pendingEmail}>{registeredEmail}</p>
                <p className={styles.pendingNote}>
                  You must verify your email before you can sign in.
                  The link expires in <strong>24 hours</strong>. Check your spam
                  folder if you don&apos;t see it.
                </p>
                <a href="/" className="btn btn--navy btn--full">
                  Back to Sign In
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ——————————————————————————————————————————————————————————————————————————————————————
  if (!token) {
    return (
      <main className={styles.root}>
        <aside className={`${styles.brandPanel} flex items-center justify-center`} aria-label="Firm information">
          <div className={styles.brandLogo}>
            <ScalesIcon />
          </div>
        </aside>

        <section className={styles.formPanel} aria-label="Registration restricted">
          <div className={styles.formInner}>
            {/* Mobile firm name strip */}
            <div className={styles.mobileHeader} aria-hidden>
              <ScalesIcon size={32} />

            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <p className={styles.cardEyebrow}>Client Portal</p>
                <h1 className={styles.cardTitle}>
                  Invitation <em>Required</em>
                </h1>
              </div>

              <div className={styles.gateBody}>
                <div className={styles.gateIconWrap}>
                  <LockIcon />
                </div>
                <h2 className={styles.gateTitle}>Registration is by invitation only.</h2>
                <p className={styles.gateDesc}>
                  Please contact <strong>Liberty</strong> to begin your
                  intake process. Once approved, you will receive a secure registration
                  link via email.
                </p>
                <div className={styles.gateDivider} />
                <p className={styles.gateContact}>
                  Already have an invitation?{" "}
                  <span className={styles.gateContactNote}>
                    Check your email for the registration link, or contact your attorney.
                  </span>
                </p>
                <a href="/" className={`btn btn--navy btn--full ${styles.gateBtn}`}>
                  ΓåÉ Back to Sign In
                </a>
              </div>
            </div>

            <p className={styles.legalNote}>
              All communications are protected by attorney-client privilege.
            </p>
          </div>
        </section>
      </main>
    );
  }

  // ΓöÇΓöÇ State B: Has Token ΓÇö Registration Form ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  return (
    <main className={styles.root}>
      {/* ΓöÇΓöÇ Brand Panel ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <aside className={`${styles.brandPanel} flex items-center justify-center`} aria-label="Firm information">
        <div className={styles.brandLogo}>
          <ScalesIcon />
        </div>
      </aside>

      {/* ΓöÇΓöÇ Form Panel ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
      <section className={styles.formPanel} aria-label="Create your account">
        <div className={styles.formInner}>
          {/* Mobile firm name strip */}
          <div className={styles.mobileHeader} aria-hidden>
            <ScalesIcon size={32} />

          </div>

          <div className={styles.card}>
            {/* Card header */}
            <div className={styles.cardHeader}>
              <p className={styles.cardEyebrow}>Client Portal</p>
              <h1 className={styles.cardTitle}>
                Create Your <em>Account</em>
              </h1>
              <p className={styles.cardSubtitle}>
                Register to securely access your legal documents and case status.
              </p>
            </div>

            {/* Form body */}
            <form
              id={`${uid}-register-form`}
              onSubmit={handleSubmit}
              noValidate
              className={styles.formBody}
            >
              {/* General error banner */}
              {errors.general && (
                <div className={styles.alertBanner} role="alert" aria-live="assertive">
                  <AlertIcon />
                  <span>{errors.general}</span>
                </div>
              )}

              {/* Email (locked ΓÇö pre-populated from invitation) */}
              <div className="form-group">
                <label htmlFor={`${uid}-email`} className="form-label">
                  Email Address
                </label>
                <input
                  id={`${uid}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className={`form-input${errors.email ? " is-error" : ""}`}
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                  }}
                  aria-describedby={errors.email ? `${uid}-email-error` : undefined}
                  aria-invalid={!!errors.email}
                  disabled={true}
                />
                {errors.email && (
                  <span id={`${uid}-email-error`} className="form-error" role="alert">
                    {errors.email}
                  </span>
                )}
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#6b7280",
                    marginTop: "0.25rem",
                    lineHeight: 1.4,
                  }}
                >
                  Your email address cannot be changed at this stage.
                </p>
              </div>

              {/* Password */}
              <div className="form-group">
                <label htmlFor={`${uid}-password`} className="form-label">
                  Password
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    id={`${uid}-password`}
                    name="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    className={`form-input${errors.password ? " is-error" : ""} ${styles.passwordInput}`}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                    }}
                    aria-describedby={
                      errors.password
                        ? `${uid}-password-error`
                        : password
                        ? `${uid}-password-strength`
                        : undefined
                    }
                    aria-invalid={!!errors.password}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    <EyeIcon visible={showPw} />
                  </button>
                </div>
                {errors.password && (
                  <span id={`${uid}-password-error`} className="form-error" role="alert">
                    {errors.password}
                  </span>
                )}
                {password && strength.level > 0 && (
                  <div id={`${uid}-password-strength`} className={styles.strengthMeter} aria-live="polite">
                    <div className={styles.strengthBars}>
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`${styles.strengthBar} ${
                            i <= strength.level ? styles[`strengthLevel${strength.level}` as keyof typeof styles] : ""
                          }`}
                        />
                      ))}
                    </div>
                    <span className={styles.strengthLabel}>{strength.label}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label htmlFor={`${uid}-confirm-password`} className="form-label">
                  Confirm Password
                </label>
                <input
                  id={`${uid}-confirm-password`}
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={`form-input${errors.confirmPassword ? " is-error" : ""}`}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined }));
                  }}
                  aria-describedby={errors.confirmPassword ? `${uid}-confirm-error` : undefined}
                  aria-invalid={!!errors.confirmPassword}
                  disabled={isLoading}
                />
                {errors.confirmPassword && (
                  <span id={`${uid}-confirm-error`} className="form-error" role="alert">
                    {errors.confirmPassword}
                  </span>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                id={`${uid}-submit`}
                className={`btn btn--primary btn--full ${styles.submitBtn}`}
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner" aria-hidden />
                    Creating accountΓÇª
                  </>
                ) : (
                  "Create My Account"
                )}
              </button>

              {/* Toggle to sign-in */}
              <p className={styles.modeToggle}>
                Already have an account?{" "}
                <a href="/" className={styles.textLink}>
                  Sign in
                </a>
              </p>
            </form>

            {/* Trust footer */}
            <div className={styles.trustFooter}>
              <span className={styles.trustItem}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                256-bit SSL
              </span>
              <span className={styles.trustDot} aria-hidden>ΓÇó</span>
              <span className={styles.trustItem}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Attorney-Client Privilege
              </span>
              <span className={styles.trustDot} aria-hidden>ΓÇó</span>
              <span className={styles.trustItem}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Available 24/7
              </span>
            </div>
          </div>

          <p className={styles.legalNote}>
            By creating an account, you agree to our{" "}
            <a href="#" className={styles.legalLink}>Terms of Service</a> and{" "}
            <a href="#" className={styles.legalLink}>Privacy Policy</a>.
            All communications are protected by attorney-client privilege.
          </p>
        </div>
      </section>
    </main>
  );
}