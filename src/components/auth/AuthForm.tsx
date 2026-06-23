"use client";

/**
 * src/components/auth/AuthForm.tsx
 *
 * Authentication gateway component for The Independence Law Firm Client Portal.
 *
 * States:
 *   "login"    — existing clients sign in
 *   "register" — new clients create an account
 *   "pending"  — account created, verification email sent (read-only notice)
 *
 * Registration collects strictly: Full Name, Email, Password (per spec).
 * Login collects: Email, Password.
 *
 * After successful registration the UI transitions to the "pending" state
 * and the user cannot proceed until they verify their email.
 */

import { useState, useCallback, useId } from "react";
import styles from "./AuthForm.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormMode = "login" | "register" | "pending";

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  general?: string;
}

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLogin(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Email address is required.";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Please enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  return errors;
}

function validateRegister(
  fullName: string,
  email: string,
  password: string
): FieldErrors {
  const errors: FieldErrors = {};
  if (!fullName.trim()) errors.fullName = "Full name is required.";
  else if (fullName.trim().length < 2) errors.fullName = "Please enter your full name.";
  if (!email.trim()) errors.email = "Email address is required.";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Please enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  else if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (!/[A-Z]/.test(password)) errors.password = "Include at least one uppercase letter.";
  else if (!/[0-9]/.test(password)) errors.password = "Include at least one number.";
  return errors;
}

// ── Password strength indicator ───────────────────────────────────────────────

function getPasswordStrength(password: string): {
  label: string;
  level: 0 | 1 | 2 | 3;
} {
  if (!password) return { label: "", level: 0 };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { label: "Weak", level: 1 };
  if (score === 2) return { label: "Fair", level: 2 };
  return { label: "Strong", level: 3 };
}

// ── Icons (inline SVG to avoid dependency) ────────────────────────────────────

function IconEye({ visible }: { visible: boolean }) {
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

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AuthForm() {
  const uid = useId();
  const [mode, setMode] = useState<FormMode>("login");

  // Field values
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");

  // Reset form when switching modes
  const switchMode = useCallback((newMode: FormMode) => {
    setMode(newMode);
    setErrors({});
    setPassword("");
    setShowPassword(false);
    if (newMode === "register") {
      setEmail("");
      setFullName("");
    }
  }, []);

  // ── Handle Login ────────────────────────────────────────────────────────────
  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const fieldErrors = validateLogin(email, password);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }
      setErrors({});
      setIsLoading(true);

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json();

        if (!res.ok) {
          // Surface server-side errors (including "email not verified")
          if (data.code === "EMAIL_NOT_VERIFIED") {
            setErrors({
              general:
                "Your email address has not been verified yet. Please check your inbox for the verification link.",
            });
          } else {
            setErrors({ general: data.message ?? "Invalid email or password." });
          }
        } else {
          // Successful login — redirect handled server-side via redirect header
          window.location.href = data.redirectTo ?? "/dashboard";
        }
      } catch {
        setErrors({ general: "Unable to connect. Please try again." });
      } finally {
        setIsLoading(false);
      }
    },
    [email, password]
  );

  // ── Handle Register ─────────────────────────────────────────────────────────
  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const fieldErrors = validateRegister(fullName, email, password);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }
      setErrors({});
      setIsLoading(true);

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.code === "EMAIL_EXISTS") {
            setErrors({
              email:
                "An account with this email already exists. Try logging in instead.",
            });
          } else {
            setErrors({ general: data.message ?? "Registration failed. Please try again." });
          }
        } else {
          // Transition to pending verification state
          setVerifiedEmail(email.trim().toLowerCase());
          setMode("pending");
        }
      } catch {
        setErrors({ general: "Unable to connect. Please try again." });
      } finally {
        setIsLoading(false);
      }
    },
    [fullName, email, password]
  );

  const passwordStrength = mode === "register" ? getPasswordStrength(password) : null;

  // ── Render: Pending Verification ────────────────────────────────────────────
  if (mode === "pending") {
    return (
      <div className={`${styles.card} animate-fade-in`}>
        <div className={styles.pendingBadge}>
          <div className={styles.pendingIcon}>
            <IconMail />
          </div>
        </div>
        <div className={styles.pendingBody}>
          <h2 className={styles.pendingTitle}>Check Your Inbox</h2>
          <p className={styles.pendingSubtitle}>
            We sent a verification link to
          </p>
          <p className={styles.pendingEmail}>{verifiedEmail}</p>
          <p className={styles.pendingNote}>
            You must verify your email address before you can log in. The link
            expires in <strong>24 hours</strong>.
          </p>
          <div className={styles.pendingChecklist}>
            <div className={styles.pendingCheckItem}>
              <span className={styles.checkIcon}><IconCheck /></span>
              Account created successfully
            </div>
            <div className={`${styles.pendingCheckItem} ${styles.pendingCheckItemPending}`}>
              <span className={styles.pendingDot} />
              Email verification pending
            </div>
            <div className={`${styles.pendingCheckItem} ${styles.pendingCheckItemLocked}`}>
              <span className={styles.lockIcon}>🔒</span>
              Portal access
            </div>
          </div>
          <p className={styles.spamNote}>
            Didn&apos;t receive it? Check your spam folder or{" "}
            <button
              className={styles.textLink}
              onClick={() => {
                /* TODO: wire up resend endpoint */
                alert("Resend functionality coming soon.");
              }}
            >
              resend the verification email
            </button>
            .
          </p>
          <button
            className={`btn btn--ghost ${styles.backToLogin}`}
            onClick={() => switchMode("login")}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  const isLogin = mode === "login";

  // ── Render: Auth Form ───────────────────────────────────────────────────────
  return (
    <div className={`${styles.card} animate-fade-in`}>
      {/* Tab switcher */}
      <div className={styles.tabs} role="tablist" aria-label="Authentication options">
        <button
          id={`${uid}-tab-login`}
          role="tab"
          aria-selected={isLogin}
          aria-controls={`${uid}-panel`}
          className={`${styles.tab} ${isLogin ? styles.tabActive : ""}`}
          onClick={() => switchMode("login")}
          type="button"
        >
          Sign In
        </button>
        <button
          id={`${uid}-tab-register`}
          role="tab"
          aria-selected={!isLogin}
          aria-controls={`${uid}-panel`}
          className={`${styles.tab} ${!isLogin ? styles.tabActive : ""}`}
          onClick={() => switchMode("register")}
          type="button"
        >
          Create Account
        </button>
      </div>

      {/* Card header */}
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>
          {isLogin ? (
            <>Welcome <em>Back</em></>
          ) : (
            <>Create Your <em>Account</em></>
          )}
        </h1>
        <p className={styles.cardSubtitle}>
          {isLogin
            ? "Sign in to access your case documents and secure portal."
            : "Register to securely access your legal documents and case status."}
        </p>
      </div>

      {/* General error alert */}
      {errors.general && (
        <div className="alert alert--error" role="alert" aria-live="assertive">
          {errors.general}
        </div>
      )}

      {/* Form */}
      <form
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={isLogin ? `${uid}-tab-login` : `${uid}-tab-register`}
        onSubmit={isLogin ? handleLogin : handleRegister}
        noValidate
        className={styles.form}
      >
        {/* Full Name — register only */}
        {!isLogin && (
          <div className="form-group">
            <label htmlFor={`${uid}-fullName`} className="form-label">
              Full Name
            </label>
            <input
              id={`${uid}-fullName`}
              name="fullName"
              type="text"
              autoComplete="name"
              spellCheck={false}
              className={`form-input${errors.fullName ? " is-error" : ""}`}
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              aria-describedby={errors.fullName ? `${uid}-fullName-error` : undefined}
              aria-invalid={!!errors.fullName}
              disabled={isLoading}
            />
            {errors.fullName && (
              <span id={`${uid}-fullName-error`} className="form-error" role="alert">
                {errors.fullName}
              </span>
            )}
          </div>
        )}

        {/* Email */}
        <div className="form-group">
          <label htmlFor={`${uid}-email`} className="form-label">
            Email Address
          </label>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            autoComplete={isLogin ? "username" : "email"}
            inputMode="email"
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
          <div className={styles.passwordLabelRow}>
            <label htmlFor={`${uid}-password`} className="form-label">
              Password
            </label>
            {isLogin && (
              <button type="button" className={styles.forgotLink}>
                Forgot password?
              </button>
            )}
          </div>
          <div className={styles.passwordWrapper}>
            <input
              id={`${uid}-password`}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              className={`form-input${errors.password ? " is-error" : ""} ${styles.passwordInput}`}
              placeholder={isLogin ? "Enter your password" : "Min. 8 characters"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              aria-describedby={
                errors.password
                  ? `${uid}-password-error`
                  : mode === "register" && password
                  ? `${uid}-password-strength`
                  : undefined
              }
              aria-invalid={!!errors.password}
              disabled={isLoading}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <IconEye visible={showPassword} />
            </button>
          </div>
          {errors.password && (
            <span id={`${uid}-password-error`} className="form-error" role="alert">
              {errors.password}
            </span>
          )}

          {/* Password strength meter */}
          {mode === "register" && password && passwordStrength && (
            <div
              id={`${uid}-password-strength`}
              className={styles.strengthMeter}
              aria-live="polite"
            >
              <div className={styles.strengthBars}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`${styles.strengthBar} ${
                      i <= passwordStrength.level
                        ? styles[`strengthLevel${passwordStrength.level}`]
                        : ""
                    }`}
                  />
                ))}
              </div>
              <span className={styles.strengthLabel}>{passwordStrength.label}</span>
            </div>
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
              {isLogin ? "Signing in…" : "Creating account…"}
            </>
          ) : isLogin ? (
            "Sign In to Portal"
          ) : (
            "Create My Account"
          )}
        </button>

        {/* Mode toggle (mobile-friendly secondary CTA) */}
        <p className={styles.modeToggle}>
          {isLogin ? (
            <>
              New client?{" "}
              <button
                type="button"
                className={styles.textLink}
                onClick={() => switchMode("register")}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className={styles.textLink}
                onClick={() => switchMode("login")}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </form>

      {/* Footer trust signals */}
      <div className={styles.trustFooter}>
        <span className={styles.trustItem}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          256-bit SSL
        </span>
        <span className={styles.trustDot} aria-hidden>•</span>
        <span className={styles.trustItem}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Attorney-Client Privilege
        </span>
        <span className={styles.trustDot} aria-hidden>•</span>
        <span className={styles.trustItem}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Available 24/7
        </span>
      </div>
    </div>
  );
}
