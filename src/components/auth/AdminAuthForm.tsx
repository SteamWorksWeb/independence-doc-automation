"use client";

/**
 * src/components/auth/AdminAuthForm.tsx
 *
 * Stealth Admin Login — "The Vault Door"
 *
 * Design mandate:
 *   - No marketing copy. No greetings. No "create account."
 *   - Header: "Login" only — Merriweather Bold-Italic, brand secondary typography
 *   - Email + Password inputs (large, mobile-friendly)
 *   - Single submit button
 *   - Role isolation: hits /api/auth/admin-login exclusively
 *     (never shares state or endpoints with client auth)
 *
 * Security:
 *   - Credentials never validated client-side
 *   - Server route checks against ADMIN_EMAIL / ADMIN_PASSWORD_HASH env vars
 *   - Generic error message on failure (no enumeration)
 *   - Submission disabled during in-flight request
 */

import { useState, useCallback, useId } from "react";
import { useRouter } from "next/navigation";
import styles from "./AdminAuthForm.module.css";

interface FieldErrors {
  email?: string;
  password?: string;
  general?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Required.";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Invalid address.";
  if (!password) errors.password = "Required.";
  return errors;
}

// ── Password visibility toggle icon ──────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminAuthForm() {
  const router = useRouter();
  const uid = useId();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [errors, setErrors]     = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const fieldErrors = validate(email, password);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }
      setErrors({});
      setIsLoading(true);

      try {
        const res = await fetch("/api/auth/admin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Role is declared explicitly in the payload so the server
          // can enforce it independently of any client-side state
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            role: "admin",
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          // Intentionally generic — never reveal whether email or password was wrong
          setErrors({ general: "Access denied." });
        } else {
          // Hardcoded — never rely on data.redirectTo to avoid any missing-field foot-guns
          // Use router.push for smooth SPA navigation (no hard reload / race condition)
          router.push("/admin/dashboard");
        }
      } catch {
        setErrors({ general: "Connection error. Try again." });
      } finally {
        setIsLoading(false);
      }
    },
    [email, password]
  );

  return (
    <div className={`${styles.card} animate-fade-in`}>
      {/* ── Vault door header ──────────────────────────────────── */}
      <div className={styles.header}>
        {/* Lock glyph */}
        <div className={styles.lockRing} aria-hidden>
          <LockIcon />
        </div>

        {/* "Login" — Bold-Italic Merriweather only, per spec */}
        <h1 className={styles.title}>
          <em>Login</em>
        </h1>

        {/* Hairline separator */}
        <div className={styles.rule} aria-hidden />
      </div>

      {/* ── General error ──────────────────────────────────────── */}
      {errors.general && (
        <div className={styles.generalError} role="alert" aria-live="assertive">
          <ShieldIcon />
          {errors.general}
        </div>
      )}

      {/* ── Form ───────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        autoComplete="off"
        className={styles.form}
      >
        {/* Email */}
        <div className={styles.field}>
          <label htmlFor={`${uid}-email`} className={styles.label}>
            Email
          </label>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            spellCheck={false}
            className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ""}`}
            value={email}
            placeholder="admin@firm.com"
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
            }}
            aria-describedby={errors.email ? `${uid}-email-err` : undefined}
            aria-invalid={!!errors.email}
            disabled={isLoading}
          />
          {errors.email && (
            <span
              id={`${uid}-email-err`}
              className={styles.fieldError}
              role="alert"
            >
              {errors.email}
            </span>
          )}
        </div>

        {/* Password */}
        <div className={styles.field}>
          <label htmlFor={`${uid}-password`} className={styles.label}>
            Password
          </label>
          <div className={styles.pwWrap}>
            <input
              id={`${uid}-password`}
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              className={`${styles.input} ${styles.pwInput}${errors.password ? ` ${styles.inputError}` : ""}`}
              value={password}
              placeholder="••••••••"
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password)
                  setErrors((p) => ({ ...p, password: undefined }));
              }}
              aria-describedby={
                errors.password ? `${uid}-password-err` : undefined
              }
              aria-invalid={!!errors.password}
              disabled={isLoading}
            />
            <button
              type="button"
              className={styles.pwToggle}
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              <EyeIcon open={showPw} />
            </button>
          </div>
          {errors.password && (
            <span
              id={`${uid}-password-err`}
              className={styles.fieldError}
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
          className={styles.submit}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className={styles.spinner} aria-hidden />
              Verifying…
            </>
          ) : (
            "Enter"
          )}
        </button>
      </form>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg
      width="22"
      height="22"
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

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
