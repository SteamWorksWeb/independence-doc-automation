"use client";

/**
 * src/app/admin/settings/page.tsx
 *
 * Admin Profile Settings page.
 *
 * - On mount: GET /api/admin/profile  → populates form fields
 * - On submit: PUT /api/admin/profile → saves changes, shows success banner
 *
 * Fields: First Name, Last Name, Email (read-only), Phone Number
 */

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminProfile {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

type FormStatus = "idle" | "loading" | "saving" | "success" | "error";

// ── Page component ─────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<FormStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState<AdminProfile>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch profile on mount ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setStatus("loading");
      setErrorMsg(null);

      try {
        const res = await fetch("/api/admin/profile", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            readMessage(data) ?? `Failed to load profile (${res.status})`
          );
        }

        if (!cancelled) {
          setForm(normalizeProfile(data));
          setStatus("idle");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : "Unable to load your profile."
          );
          setStatus("error");
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Handle form submit ────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "saving") return;

    setStatus("saving");
    setErrorMsg(null);

    // Clear any pending success dismiss timer
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
          phone: form.phone.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          readMessage(data) ?? `Save failed (${res.status})`
        );
      }

      // Optionally refresh form from the response
      if (isRecord(data)) {
        setForm(normalizeProfile(data));
      }

      setStatus("success");
      successTimerRef.current = setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Unable to save your profile."
      );
      setStatus("error");
    }
  }

  // ── Field change helper ───────────────────────────────────────────────────

  function handleChange(field: keyof AdminProfile, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error/success state when the user starts editing again
    if (status === "error" || status === "success") {
      setStatus("idle");
      setErrorMsg(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex max-w-[820px] flex-col gap-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="font-serif text-[clamp(1.4rem,2.5vw,1.875rem)] font-black italic leading-tight text-navy">
          Account Settings
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Update your profile information visible to clients and colleagues.
        </p>
      </div>

      {/* Profile card */}
      <section className="rounded-lg border border-border bg-white shadow-sm">
        {/* Section header */}
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-serif text-base font-bold text-navy">
            Profile Information
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">
            Your name and contact details.
          </p>
        </div>

        {/* Loading skeleton */}
        {status === "loading" && (
          <div className="animate-pulse space-y-5 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="mb-2 h-3 w-24 rounded bg-border" />
                <div className="h-10 w-full rounded-md bg-border" />
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        {status !== "loading" && (
          <form
            id="admin-profile-form"
            onSubmit={handleSubmit}
            className="p-6"
            noValidate
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {/* First Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="settings-first-name"
                  className="text-xs font-bold uppercase tracking-[0.06em] text-text-muted"
                >
                  First Name
                </label>
                <input
                  id="settings-first-name"
                  type="text"
                  autoComplete="given-name"
                  placeholder="e.g. Jane"
                  value={form.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  disabled={status === "saving"}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm font-medium text-text-primary shadow-sm outline-none placeholder:text-text-muted/60 transition focus:border-navy focus:ring-2 focus:ring-navy/10 disabled:cursor-wait disabled:opacity-70"
                />
              </div>

              {/* Last Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="settings-last-name"
                  className="text-xs font-bold uppercase tracking-[0.06em] text-text-muted"
                >
                  Last Name
                </label>
                <input
                  id="settings-last-name"
                  type="text"
                  autoComplete="family-name"
                  placeholder="e.g. Doe"
                  value={form.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  disabled={status === "saving"}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm font-medium text-text-primary shadow-sm outline-none placeholder:text-text-muted/60 transition focus:border-navy focus:ring-2 focus:ring-navy/10 disabled:cursor-wait disabled:opacity-70"
                />
              </div>

              {/* Email — read-only; changes require a separate verification flow */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label
                  htmlFor="settings-email"
                  className="text-xs font-bold uppercase tracking-[0.06em] text-text-muted"
                >
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="settings-email"
                    type="email"
                    autoComplete="email"
                    readOnly
                    aria-readonly="true"
                    value={form.email}
                    className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm font-medium text-text-muted shadow-sm outline-none cursor-default select-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-text-muted/70">
                    Read-only
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Email cannot be changed here. Contact your system administrator.
                </p>
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label
                  htmlFor="settings-phone"
                  className="text-xs font-bold uppercase tracking-[0.06em] text-text-muted"
                >
                  Phone Number
                </label>
                <input
                  id="settings-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. (555) 000-1234"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  disabled={status === "saving"}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm font-medium text-text-primary shadow-sm outline-none placeholder:text-text-muted/60 transition focus:border-navy focus:ring-2 focus:ring-navy/10 disabled:cursor-wait disabled:opacity-70"
                />
              </div>
            </div>

            {/* Success banner */}
            {status === "success" && (
              <div
                role="status"
                className="mt-5 flex items-center gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
              >
                <CheckCircleIcon />
                Profile updated successfully.
              </div>
            )}

            {/* Error banner */}
            {status === "error" && errorMsg && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <AlertIcon />
                <span>
                  <strong className="font-bold">Error: </strong>
                  {errorMsg}
                </span>
              </div>
            )}

            {/* Submit row */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-5">
              <button
                id="admin-profile-save-btn"
                type="submit"
                disabled={status === "saving"}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-navy px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy/90 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                {status === "saving" ? (
                  <>
                    <SpinnerIcon />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function normalizeProfile(data: unknown): AdminProfile {
  const record = isRecord(data)
    ? data
    : isRecord((data as Record<string, unknown>)?.profile)
    ? (data as Record<string, unknown>).profile
    : isRecord((data as Record<string, unknown>)?.data)
    ? (data as Record<string, unknown>).data
    : {};

  const r = record as Record<string, unknown>;

  return {
    id: typeof r.id === "string" ? r.id : undefined,
    firstName: typeof r.firstName === "string" ? r.firstName : "",
    lastName: typeof r.lastName === "string" ? r.lastName : "",
    email: typeof r.email === "string" ? r.email : "",
    phone: typeof r.phone === "string" ? r.phone : "",
  };
}

function readMessage(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const msg = data.message ?? data.error;
  return typeof msg === "string" ? msg : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function CheckCircleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
