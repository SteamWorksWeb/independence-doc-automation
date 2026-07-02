/**
 * src/components/admin/InviteClientModal.tsx
 *
 * "Invite Client" button + modal dialog for the Admin Client Directory.
 *
 * This is a client component ("use client") that lives inside the server-rendered
 * Clients page. It handles:
 *   1. Button click → open modal
 *   2. Email input + submit
 *   3. POST to /admin/invites with Bearer token from admin_session cookie
 *   4. Display success (invite link/token) or error feedback
 */

"use client";

import { useState, useCallback, useId, useRef, useEffect } from "react";
import styles from "./InviteClientModal.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type ModalState = "closed" | "idle" | "loading" | "success" | "error";

interface InviteResult {
  token?: string;
  inviteLink?: string;
  email?: string;
  message?: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface InviteClientModalProps {
  adminToken: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InviteClientModal({ adminToken }: InviteClientModalProps) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [modalState, setModalState] = useState<ModalState>("closed");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [result, setResult] = useState<InviteResult>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // ── Open / Close ──────────────────────────────────────────────────────────

  const openModal = useCallback(() => {
    setModalState("idle");
    setEmail("");
    setEmailError("");
    setResult({});
    setErrorMessage("");
    setCopied(false);
    dialogRef.current?.showModal();
    // Focus the email input after the dialog opens
    setTimeout(() => emailInputRef.current?.focus(), 50);
  }, []);

  const closeModal = useCallback(() => {
    setModalState("closed");
    dialogRef.current?.close();
  }, []);

  // Close on Escape key (native dialog handles this, but reset state)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => setModalState("closed");
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate email
      const trimmed = email.trim();
      if (!trimmed) {
        setEmailError("Email address is required.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailError("Please enter a valid email address.");
        return;
      }

      setEmailError("");
      setModalState("loading");

      try {
        const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
        const res = await fetch(`${apiUrl}/admin/invites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ email: trimmed.toLowerCase() }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || body.message || `Server responded with ${res.status}`
          );
        }

        const data = await res.json();
        setResult({
          token: data.token,
          inviteLink: data.inviteLink,
          email: trimmed.toLowerCase(),
          message: data.message,
        });
        setModalState("success");
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to send invite."
        );
        setModalState("error");
      }
    },
    [email, adminToken]
  );

  // ── Copy to clipboard ──────────────────────────────────────────────────────

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text in an input
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  // Derive a display-friendly invite link
  const displayLink =
    result.inviteLink ||
    (result.token
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?token=${result.token}`
      : "");

  return (
    <>
      {/* ── Trigger Button ──────────────────────────────────── */}
      <button
        id="invite-client-btn"
        type="button"
        className={styles.inviteBtn}
        onClick={openModal}
        aria-haspopup="dialog"
      >
        <PlusIcon />
        Invite Client
      </button>

      {/* ── Modal Dialog ────────────────────────────────────── */}
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`${uid}-title`}
        onClick={(e) => {
          // Close on backdrop click (click on the dialog element itself)
          if (e.target === dialogRef.current) closeModal();
        }}
      >
        <div className={styles.dialogContent}>
          {/* Header */}
          <div className={styles.dialogHeader}>
            <div>
              <h2 id={`${uid}-title`} className={styles.dialogTitle}>
                {modalState === "success"
                  ? "Invitation Sent"
                  : "Invite a New Client"}
              </h2>
              {modalState !== "success" && (
                <p className={styles.dialogSubtitle}>
                  Enter the client&apos;s email to generate a secure
                  registration invite.
                </p>
              )}
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={closeModal}
              aria-label="Close dialog"
            >
              <XIcon />
            </button>
          </div>

          {/* Body */}
          <div className={styles.dialogBody}>
            {/* ── Idle / Loading state — the form ─────────────── */}
            {(modalState === "idle" || modalState === "loading") && (
              <form onSubmit={handleSubmit} noValidate>
                <div className={styles.fieldGroup}>
                  <label
                    htmlFor={`${uid}-email`}
                    className={styles.fieldLabel}
                  >
                    Client Email Address
                  </label>
                  <input
                    ref={emailInputRef}
                    id={`${uid}-email`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={`${styles.fieldInput} ${
                      emailError ? styles.fieldInputError : ""
                    }`}
                    placeholder="client@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    disabled={modalState === "loading"}
                    aria-invalid={!!emailError}
                    aria-describedby={
                      emailError ? `${uid}-email-err` : undefined
                    }
                  />
                  {emailError && (
                    <span
                      id={`${uid}-email-err`}
                      className={styles.fieldError}
                      role="alert"
                    >
                      {emailError}
                    </span>
                  )}
                </div>

                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={closeModal}
                    disabled={modalState === "loading"}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={modalState === "loading"}
                    aria-busy={modalState === "loading"}
                  >
                    {modalState === "loading" ? (
                      <>
                        <span className={styles.spinner} aria-hidden />
                        Sending…
                      </>
                    ) : (
                      <>
                        <SendIcon />
                        Send Invite
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ── Success state ───────────────────────────────── */}
            {modalState === "success" && (
              <div className={styles.successState}>
                <div className={styles.successIconWrap}>
                  <CheckCircleIcon />
                </div>
                <p className={styles.successMessage}>
                  {result.message ||
                    `Invitation sent to ${result.email || "the client"}.`}
                </p>

                {displayLink && (
                  <div className={styles.tokenBox}>
                    <label className={styles.tokenLabel}>
                      Registration Link
                    </label>
                    <div className={styles.tokenRow}>
                      <code className={styles.tokenValue}>{displayLink}</code>
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={() => handleCopy(displayLink)}
                        aria-label="Copy link to clipboard"
                      >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {result.token && !result.inviteLink && (
                  <div className={styles.tokenBox}>
                    <label className={styles.tokenLabel}>
                      Raw Token (for testing)
                    </label>
                    <div className={styles.tokenRow}>
                      <code className={styles.tokenValue}>{result.token}</code>
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={() => handleCopy(result.token!)}
                        aria-label="Copy token to clipboard"
                      >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={closeModal}
                  style={{ marginTop: "0.5rem" }}
                >
                  Done
                </button>
              </div>
            )}

            {/* ── Error state ─────────────────────────────────── */}
            {modalState === "error" && (
              <div className={styles.errorState}>
                <div className={styles.errorIconWrap}>
                  <AlertTriangleIcon />
                </div>
                <p className={styles.errorMessage}>{errorMessage}</p>
                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={closeModal}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className={styles.submitBtn}
                    onClick={() => setModalState("idle")}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

// ── Inline SVG Icons ────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
