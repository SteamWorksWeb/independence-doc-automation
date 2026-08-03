"use client";

/**
 * src/components/admin/InviteLawyerModal.tsx
 *
 * Modal dialog for inviting a new Lawyer to the firm.
 * Uses the native <dialog> element pattern consistent with InviteClientModal.
 *
 * Fields   : First Name, Last Name, Email
 * On submit: POST /api/admin/super-admin/staff/invite
 * On success: toast notification + close modal + refresh staff list
 */

import { useState, useCallback, useId, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ModalState = "closed" | "idle" | "loading" | "success" | "error";

// ── Props ─────────────────────────────────────────────────────────────────────

interface InviteLawyerModalProps {
  /** Called after a successful invite so the parent can refresh its staff list */
  onSuccess: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InviteLawyerModal({ onSuccess }: InviteLawyerModalProps) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);

  const [modalState, setModalState] = useState<ModalState>("closed");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // ── Open / Close ──────────────────────────────────────────────────────────

  const openModal = useCallback(() => {
    setModalState("idle");
    setFirstName("");
    setLastName("");
    setEmail("");
    setFieldErrors({});
    setErrorMessage("");
    setToast(null);
    dialogRef.current?.showModal();
    setTimeout(() => firstNameRef.current?.focus(), 50);
  }, []);

  const closeModal = useCallback(() => {
    setModalState("closed");
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => setModalState("closed");
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!firstName.trim()) errors.firstName = "First name is required.";
    if (!lastName.trim()) errors.lastName = "Last name is required.";
    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (modalState === "loading") return;
      if (!validate()) return;

      setModalState("loading");
      setErrorMessage("");

      try {
        const res = await fetch("/api/admin/super-admin/staff/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
          }),
        });

        const data = await res.json() as { message?: string };

        if (!res.ok) {
          setModalState("error");
          setErrorMessage(data.message ?? "Failed to send invite. Please try again.");
          return;
        }

        // Success path
        setModalState("success");
        setToast(`Invite sent to ${email.trim()} ✓`);
        onSuccess(); // trigger parent list refresh
        setTimeout(() => closeModal(), 1500);
      } catch {
        setModalState("error");
        setErrorMessage("A network error occurred. Please try again.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modalState, firstName, lastName, email, onSuccess]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating success toast ─────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 bg-[#1a4731] text-emerald-200 border border-emerald-700/60 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold animate-[slideUp_0.3s_ease]"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          {toast}
        </div>
      )}

      {/* ── Trigger button ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={openModal}
        id="invite-lawyer-btn"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition-colors duration-150 shadow-sm cursor-pointer"
      >
        <PlusIcon />
        Invite Lawyer
      </button>

      {/* ── Modal dialog ───────────────────────────────────────────────── */}
      <dialog
        ref={dialogRef}
        aria-labelledby={`${uid}-title`}
        className="m-auto w-full max-w-md rounded-2xl bg-[#13192b] border border-white/10 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm p-0 open:flex open:flex-col"
        onClick={(e) => { if (e.target === dialogRef.current) closeModal(); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
          <div>
            <h2
              id={`${uid}-title`}
              className="text-white font-bold text-lg leading-tight"
            >
              Invite Lawyer
            </h2>
            <p className="text-white/45 text-xs mt-0.5">
              Send an invitation to onboard a new staff attorney.
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close dialog"
            className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded-md hover:bg-white/8 cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="px-6 pt-5 pb-6 flex flex-col gap-4">

          {/* First / Last Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${uid}-firstName`}
                className="block text-xs font-semibold text-white/60 mb-1.5 tracking-wide"
              >
                First Name
              </label>
              <input
                ref={firstNameRef}
                id={`${uid}-firstName`}
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setFieldErrors(p => ({ ...p, firstName: "" })); }}
                autoComplete="given-name"
                placeholder="Jane"
                disabled={modalState === "loading" || modalState === "success"}
                className={`w-full bg-white/6 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-[border-color,box-shadow] duration-150 focus:border-amber-400/70 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.12)] disabled:opacity-50 disabled:cursor-not-allowed ${
                  fieldErrors.firstName ? "border-red-500/70" : "border-white/12"
                }`}
              />
              {fieldErrors.firstName && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.firstName}</p>
              )}
            </div>

            <div>
              <label
                htmlFor={`${uid}-lastName`}
                className="block text-xs font-semibold text-white/60 mb-1.5 tracking-wide"
              >
                Last Name
              </label>
              <input
                id={`${uid}-lastName`}
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setFieldErrors(p => ({ ...p, lastName: "" })); }}
                autoComplete="family-name"
                placeholder="Smith"
                disabled={modalState === "loading" || modalState === "success"}
                className={`w-full bg-white/6 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-[border-color,box-shadow] duration-150 focus:border-amber-400/70 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.12)] disabled:opacity-50 disabled:cursor-not-allowed ${
                  fieldErrors.lastName ? "border-red-500/70" : "border-white/12"
                }`}
              />
              {fieldErrors.lastName && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.lastName}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor={`${uid}-email`}
              className="block text-xs font-semibold text-white/60 mb-1.5 tracking-wide"
            >
              Email Address
            </label>
            <input
              id={`${uid}-email`}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: "" })); }}
              autoComplete="email"
              placeholder="jane@independencelaw.com"
              disabled={modalState === "loading" || modalState === "success"}
              className={`w-full bg-white/6 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-[border-color,box-shadow] duration-150 focus:border-amber-400/70 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.12)] disabled:opacity-50 disabled:cursor-not-allowed ${
                fieldErrors.email ? "border-red-500/70" : "border-white/12"
              }`}
            />
            {fieldErrors.email && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {/* Error banner */}
          {modalState === "error" && errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 bg-red-950/60 border border-red-700/50 rounded-lg px-3.5 py-3 text-red-300 text-sm"
            >
              <AlertIcon />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={closeModal}
              disabled={modalState === "loading"}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalState === "loading" || modalState === "success"}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-white font-semibold text-sm rounded-lg transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
              id="invite-lawyer-submit-btn"
            >
              {modalState === "loading" ? (
                <><SpinnerIcon /> Sending…</>
              ) : modalState === "success" ? (
                "Sent ✓"
              ) : (
                "Send Invite"
              )}
            </button>
          </div>

        </form>
      </dialog>
    </>
  );
}

// ── Inline Icons ──────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
