"use client";

/**
 * src/components/auth/ClientLoginForm.tsx
 *
 * Client Login Form — "use client" component for the Independence Law
 * Client Portal.
 *
 * Dual-mode operation (determined by URL ?token= param):
 *
 *   MODE A — Standard login (no token):
 *     "Welcome Back" UI with Email + Password fields.
 *     Calls the `loginClient` Server Action via useTransition.
 *     On success → router.push('/dashboard')
 *
 *   MODE B — Account setup (token present):
 *     "Set Up Your Account" UI with New Password + Confirm Password fields.
 *     POSTs directly to NEXT_PUBLIC_AWS_API_URL/auth/accept-invite
 *     with { token, password }.
 *     On success → clears token from URL → router.push('/dashboard')
 *
 * UX contract (login mode):
 *   - UNVERIFIED (403): amber banner — "check your inbox"
 *   - INVALID_CREDENTIALS (401): inline general error (intentionally vague)
 *   - VALIDATION (400): field-level inline errors
 *   - SERVER_ERROR: red banner with retry guidance
 *
 * Security notes:
 *   - No credentials are logged or stored client-side
 *   - The JWT cookie is written server-side by the loginClient action / the
 *     accept-invite endpoint, invisible to this component (httpOnly)
 *   - Token is consumed once on success; URL is replaced to prevent reuse
 */

import { useState, useTransition, useId, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginClient } from "@/actions/loginClient";
import styles from "./ClientLoginForm.module.css";

// ── Field validation ──────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
  unverified?: string;
}

function validateLoginFields(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = "Please enter a valid email address.";
  }
  if (!password) {
    errors.password = "Password is required.";
  }
  return errors;
}

function validateSetupFields(
  password: string,
  confirmPassword: string
): FieldErrors {
  const errors: FieldErrors = {};
  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientLoginForm() {
  const uid = useId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Detect invite token from URL
  const inviteToken = searchParams.get("token") ?? "";
  const isSetupMode = inviteToken.length > 0;

  // Form state — shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // ── Setup submit handler ────────────────────────────────────────────────────
  const handleSetupSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const fieldErrors = validateSetupFields(password, confirmPassword);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }
      setErrors({});

      startTransition(async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/$/, "");
          if (!apiUrl) {
            setErrors({
              general:
                "Configuration error: API URL is not set. Please contact support.",
            });
            return;
          }

          const res = await fetch(`${apiUrl}/auth/accept-invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: inviteToken, password }),
            credentials: "include",
          });

          if (res.ok) {
            // Token is consumed — remove it from the URL so a hard-refresh
            // doesn't re-submit, then navigate to the portal dashboard.
            const url = new URL(window.location.href);
            url.searchParams.delete("token");
            window.history.replaceState({}, "", url.toString());
            router.push("/dashboard");
            return;
          }

          // Error handling
          let message = "Account setup failed. Please try again or contact support.";
          try {
            const body = await res.json();
            if (body?.message) message = body.message;
            else if (body?.error) message = body.error;
          } catch {
            // ignore JSON parse failure
          }

          if (res.status === 400) {
            setErrors({ general: message });
          } else if (res.status === 404 || res.status === 410) {
            setErrors({
              general:
                "This invitation link is invalid or has already been used. Please contact your attorney.",
            });
          } else {
            setErrors({ general: message });
          }
        } catch {
          setErrors({
            general:
              "A network error occurred. Please check your connection and try again.",
          });
        }
      });
    },
    [inviteToken, password, confirmPassword, router]
  );

  // ── Login submit handler ────────────────────────────────────────────────────
  const handleLoginSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Client-side guard (mirrors server validation)
      const fieldErrors = validateLoginFields(email, password);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }
      setErrors({});

      startTransition(async () => {
        const result = await loginClient(email.trim(), password);

        if (result.ok) {
          // Cookie is already set by the server action — navigate directly
          router.push("/dashboard");
          return;
        }

        switch (result.code) {
          case "UNVERIFIED":
            setErrors({ unverified: result.message });
            break;
          case "INVALID_CREDENTIALS":
            // Generic — no enumeration signal to the user
            setErrors({
              general:
                "Invalid email or password. Please check your credentials and try again.",
            });
            break;
          case "VALIDATION":
            setErrors({ general: result.message });
            break;
          case "SERVER_ERROR":
          default:
            setErrors({ general: result.message });
            break;
        }
      });
    },
    [email, password, router]
  );

  const isLoading = isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`${styles.card} animate-fade-in`}>
      {/* ── Card header ──────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.portalBadge} aria-hidden>
          {isSetupMode ? <KeyIcon /> : <PortalIcon />}
        </div>
        <h1 className={styles.title}>
          {isSetupMode ? (
            <>
              Set Up Your <em>Account</em>
            </>
          ) : (
            <>
              Welcome <em>Back</em>
            </>
          )}
        </h1>
        <p className={styles.subtitle}>
          {isSetupMode
            ? "Create a secure password to activate your client portal access."
            : "Sign in to access your case documents and secure portal."}
        </p>
      </div>

      {/* ── Unverified banner (login mode, 403) ───────────────── */}
      {!isSetupMode && errors.unverified && (
        <div
          className={styles.unverifiedBanner}
          role="alert"
          aria-live="assertive"
          id={`${uid}-unverified-alert`}
        >
          <EnvelopeIcon />
          <div>
            <strong>Email not yet verified.</strong>
            <p>{errors.unverified}</p>
          </div>
        </div>
      )}

      {/* ── General error alert ───────────────────────────────── */}
      {errors.general && (
        <div
          className="alert alert--error"
          role="alert"
          aria-live="assertive"
          id={`${uid}-general-error`}
        >
          {errors.general}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODE B — Account Setup (invite token present)
      ════════════════════════════════════════════════════════ */}
      {isSetupMode ? (
        <form
          onSubmit={handleSetupSubmit}
          noValidate
          autoComplete="new-password"
          className={styles.form}
        >
          {/* New Password */}
          <div className="form-group">
            <label htmlFor={`${uid}-new-password`} className="form-label">
              New Password
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id={`${uid}-new-password`}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className={`form-input${errors.password ? " is-error" : ""} ${styles.passwordInput}`}
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                aria-describedby={
                  errors.password ? `${uid}-password-error` : `${uid}-password-hint`
                }
                aria-invalid={!!errors.password}
                disabled={isLoading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {errors.password ? (
              <span
                id={`${uid}-password-error`}
                className="form-error"
                role="alert"
              >
                {errors.password}
              </span>
            ) : (
              <span id={`${uid}-password-hint`} className="form-hint">
                Minimum {MIN_PASSWORD_LENGTH} characters.
              </span>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor={`${uid}-confirm-password`} className="form-label">
              Confirm Password
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id={`${uid}-confirm-password`}
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                className={`form-input${errors.confirmPassword ? " is-error" : ""} ${styles.passwordInput}`}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword)
                    setErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                }}
                aria-describedby={
                  errors.confirmPassword
                    ? `${uid}-confirm-error`
                    : undefined
                }
                aria-invalid={!!errors.confirmPassword}
                disabled={isLoading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                tabIndex={-1}
              >
                <EyeIcon open={showConfirmPassword} />
              </button>
            </div>
            {errors.confirmPassword && (
              <span
                id={`${uid}-confirm-error`}
                className="form-error"
                role="alert"
              >
                {errors.confirmPassword}
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            id={`${uid}-setup-submit`}
            type="submit"
            className={`btn btn--primary btn--full ${styles.submitBtn}`}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner" aria-hidden />
                Setting up account…
              </>
            ) : (
              "Create Account & Enter Portal"
            )}
          </button>
        </form>
      ) : (
        /* ════════════════════════════════════════════════════════
           MODE A — Standard Login (no token)
        ════════════════════════════════════════════════════════ */
        <form
          onSubmit={handleLoginSubmit}
          noValidate
          autoComplete="on"
          className={styles.form}
        >
          {/* Email */}
          <div className="form-group">
            <label htmlFor={`${uid}-email`} className="form-label">
              Email Address
            </label>
            <input
              id={`${uid}-email`}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              spellCheck={false}
              className={`form-input${errors.email ? " is-error" : ""}`}
              placeholder="your@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              aria-describedby={errors.email ? `${uid}-email-error` : undefined}
              aria-invalid={!!errors.email}
              disabled={isLoading}
            />
            {errors.email && (
              <span id={`${uid}-email-error`} className="form-error" role="alert">
                {errors.email}
              </span>
            )}
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
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={`form-input${errors.password ? " is-error" : ""} ${styles.passwordInput}`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                aria-describedby={
                  errors.password ? `${uid}-password-error` : undefined
                }
                aria-invalid={!!errors.password}
                disabled={isLoading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {errors.password && (
              <span
                id={`${uid}-password-error`}
                className="form-error"
                role="alert"
              >
                {errors.password}
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            id={`${uid}-submit`}
            type="submit"
            className={`btn btn--primary btn--full ${styles.submitBtn}`}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner" aria-hidden />
                Signing in…
              </>
            ) : (
              "Sign In to Portal"
            )}
          </button>
        </form>
      )}

      {/* ── Trust footer ─────────────────────────────────────── */}
      <div className={styles.trustFooter}>
        <span className={styles.trustItem}>
          <LockIcon />
          256-bit SSL
        </span>
        <span className={styles.trustDot} aria-hidden>•</span>
        <span className={styles.trustItem}>
          <ShieldIcon />
          Attorney-Client Privilege
        </span>
        <span className={styles.trustDot} aria-hidden>•</span>
        <span className={styles.trustItem}>
          <ClockIcon />
          Available 24/7
        </span>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PortalIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Key icon — used as the badge in account-setup mode */
function KeyIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6" />
      <path d="M15.5 7.5l3 3L22 7l-3-3" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0, marginTop: "2px" }}
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
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

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
