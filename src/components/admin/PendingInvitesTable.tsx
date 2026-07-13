/**
 * src/components/admin/PendingInvitesTable.tsx
 *
 * Client component that fetches and displays pending client invitations.
 *
 * Migrated from CSS Modules → Tailwind CSS (Phase 2).
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invitation {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface PendingInvitesTableProps {
  adminToken: string;
}

type FetchState = "loading" | "success" | "error";

interface Toast {
  message: string;
  type: "success" | "error";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PendingInvitesTable({ adminToken }: PendingInvitesTableProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── Fetch pending invites ─────────────────────────────────────────────────

  const fetchInvites = useCallback(async () => {
    setFetchState("loading");
    setErrorMessage("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
      const res = await fetch(`${apiUrl}/admin/invites`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || body.message || `Server responded with ${res.status}`
        );
      }

      const data = await res.json();
      const raw: Invitation[] = Array.isArray(data)
        ? data
        : (data.invitations ?? []);

      setInvitations(raw);
      setFetchState("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load invitations."
      );
      setFetchState("error");
    }
  }, [adminToken]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  // ── Re-fetch when a new invite is sent from the modal ────────────────────

  useEffect(() => {
    const handleInviteSent = () => fetchInvites();
    window.addEventListener("inviteSent", handleInviteSent);
    return () => window.removeEventListener("inviteSent", handleInviteSent);
  }, [fetchInvites]);

  // ── Copy invite link ──────────────────────────────────────────────────────

  const handleCopyLink = useCallback(async (invite: Invitation) => {
    const url = `${window.location.origin}/register?token=${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invite.id);
      setToast({ message: `Link copied for ${invite.email}`, type: "success" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setToast({ message: "Failed to copy to clipboard.", type: "error" });
    }
  }, []);

  // ── Revoke invitation ─────────────────────────────────────────────────────

  const handleRevoke = useCallback(async (invite: Invitation) => {
    if (revokingId) return;

    setRevokingId(invite.id);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
      const res = await fetch(`${apiUrl}/admin/invites/${invite.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || body.message || `Server responded with ${res.status}`
        );
      }

      setInvitations((prev) => prev.filter((inv) => inv.id !== invite.id));
      setToast({ message: `Invitation to ${invite.email} revoked.`, type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to revoke invitation.",
        type: "error",
      });
    } finally {
      setRevokingId(null);
    }
  }, [adminToken, revokingId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Loading ────────────────────────────────────────── */}
      {fetchState === "loading" && (
        <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
          <div className="w-7 h-7 border-[3px] border-border border-t-crimson rounded-full animate-spin" aria-hidden />
          <p className="text-sm text-text-muted">Loading pending invitations…</p>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────── */}
      {fetchState === "error" && (
        <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
          <div className="w-[68px] h-[68px] rounded-full bg-error-bg flex items-center justify-center text-error mb-1">
            <AlertIcon />
          </div>
          <p className="font-serif text-[1.0625rem] font-bold text-text-primary">Failed to Load Invitations</p>
          <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">{errorMessage}</p>
          <button
            type="button"
            className="mt-2 font-sans text-[0.8125rem] font-semibold text-crimson bg-transparent border border-crimson py-1.5 px-4 rounded-md cursor-pointer transition-[background,color] duration-150 ease-in-out hover:bg-crimson hover:text-white"
            onClick={fetchInvites}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Empty ──────────────────────────────────────────── */}
      {fetchState === "success" && invitations.length === 0 && (
        <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
          <div className="w-[68px] h-[68px] rounded-full bg-bg flex items-center justify-center text-text-muted mb-1">
            <MailIcon />
          </div>
          <p className="font-serif text-[1.0625rem] font-bold text-text-primary">No pending invitations</p>
          <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">
            All invitations have been used or expired. Use the
            &ldquo;Invite Client&rdquo; button to send a new one.
          </p>
        </div>
      )}

      {/* ── Data table ─────────────────────────────────────── */}
      {fetchState === "success" && invitations.length > 0 && (
        <>
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full border-collapse text-sm min-w-[560px]" aria-label="Pending invitations">
              <thead>
                <tr>
                  <th className="py-[11px] px-4 first:pl-6 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">#</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Email</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Sent Date</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Status</th>
                  <th className="py-[11px] px-4 last:pr-6 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invite, index) => {
                  const expired = isExpired(invite.expiresAt);
                  return (
                    <tr key={invite.id} className="border-b border-border last:border-b-0 transition-[background] duration-150 ease-in-out hover:bg-[#fafbfc]">
                      <td className="py-3.5 px-4 first:pl-6 text-text-muted text-[0.8125rem] font-medium w-10 align-middle">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-medium align-middle">
                        {invite.email}
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap align-middle">
                        {formatDate(invite.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${
                            expired
                              ? "bg-bg-alt text-text-muted"
                              : "bg-success-bg text-success"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80" aria-hidden />
                          {expired ? "Expired" : "Active"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 last:pr-6 align-middle">
                        <div className="flex items-center gap-2 flex-nowrap max-[640px]:flex-col max-[640px]:gap-1.5">
                          <button
                            type="button"
                            className={`inline-flex items-center gap-[5px] font-sans text-xs font-semibold py-[5px] px-3 rounded-md border cursor-pointer whitespace-nowrap transition-[background,border-color,color] duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${
                              copiedId === invite.id
                                ? "border-success text-success bg-success-bg"
                                : "border-border bg-white text-text-primary hover:bg-bg hover:border-navy hover:text-navy"
                            }`}
                            onClick={() => handleCopyLink(invite)}
                            disabled={revokingId === invite.id}
                            aria-label={`Copy registration link for ${invite.email}`}
                          >
                            {copiedId === invite.id ? (
                              <><CheckIcon /> Copied!</>
                            ) : (
                              <><CopyIcon /> Copy Link</>
                            )}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-[5px] font-sans text-xs font-semibold py-[5px] px-3 rounded-md border border-transparent bg-[rgba(179,30,60,0.08)] text-crimson cursor-pointer whitespace-nowrap transition-[background,border-color,color] duration-150 ease-in-out hover:bg-crimson hover:border-crimson hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleRevoke(invite)}
                            disabled={revokingId === invite.id}
                            aria-label={`Revoke invitation for ${invite.email}`}
                          >
                            {revokingId === invite.id ? (
                              <><span className="w-3 h-3 border-2 border-border border-t-crimson rounded-full animate-spin shrink-0" aria-hidden /> Revoking…</>
                            ) : (
                              <><XIcon /> Revoke</>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="py-3 px-6 border-t border-border bg-bg flex items-center justify-end">
            <span className="text-[0.8125rem] text-text-muted">
              {invitations.length} pending{" "}
              {invitations.length === 1 ? "invitation" : "invitations"}
            </span>
          </div>
        </>
      )}

      {/* ── Toast notification ─────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 flex items-center gap-2 text-white py-3 px-5 rounded-lg font-sans text-[0.8125rem] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.18)] z-[1000] animate-[toastIn_300ms_ease-out] ${
            toast.type === "success" ? "bg-success" : "bg-crimson"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.type === "success" ? <CheckIcon /> : <AlertIcon />}
          {toast.message}
        </div>
      )}
    </>
  );
}

// ── Inline SVG Icons ────────────────────────────────────────────────────────

function CopyIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
}

function CheckIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>);
}

function XIcon() {
  return (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);
}

function AlertIcon() {
  return (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>);
}

function MailIcon() {
  return (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" /></svg>);
}
