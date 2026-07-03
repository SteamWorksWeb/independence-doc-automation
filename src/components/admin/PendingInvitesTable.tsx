/**
 * src/components/admin/PendingInvitesTable.tsx
 *
 * Client component that fetches and displays pending client invitations.
 * Supports two actions per invite:
 *   - Copy Link: constructs the registration URL and copies to clipboard
 *   - Revoke: DELETEs the invite via the backend and removes it from local state
 *
 * Mounted inside the "Pending Invites" tab of the Client Directory page.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./PendingInvitesTable.module.css";

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

  // ── Auto-dismiss toast ────────────────────────────────────────────────────
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
    if (revokingId) return; // prevent double-clicks

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

      // Optimistic removal from local state
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
        <div className={styles.loadingState}>
          <div className={styles.spinner} aria-hidden />
          <p className={styles.loadingText}>Loading pending invitations…</p>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────── */}
      {fetchState === "error" && (
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>
            <AlertIcon />
          </div>
          <p className={styles.errorTitle}>Failed to Load Invitations</p>
          <p className={styles.errorBody}>{errorMessage}</p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={fetchInvites}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Empty ──────────────────────────────────────────── */}
      {fetchState === "success" && invitations.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <MailIcon />
          </div>
          <p className={styles.emptyTitle}>No pending invitations</p>
          <p className={styles.emptyBody}>
            All invitations have been used or expired. Use the
            &ldquo;Invite Client&rdquo; button to send a new one.
          </p>
        </div>
      )}

      {/* ── Data table ─────────────────────────────────────── */}
      {fetchState === "success" && invitations.length > 0 && (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Pending invitations">
              <thead>
                <tr>
                  <th className={styles.th} scope="col">#</th>
                  <th className={styles.th} scope="col">Email</th>
                  <th className={styles.th} scope="col">Sent Date</th>
                  <th className={styles.th} scope="col">Status</th>
                  <th className={styles.th} scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invite, index) => {
                  const expired = isExpired(invite.expiresAt);
                  return (
                    <tr key={invite.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.tdIndex}`}>
                        {index + 1}
                      </td>
                      <td className={`${styles.td} ${styles.tdEmail}`}>
                        {invite.email}
                      </td>
                      <td className={`${styles.td} ${styles.tdDate}`}>
                        {formatDate(invite.createdAt)}
                      </td>
                      <td className={styles.td}>
                        <span
                          className={`${styles.statusBadge} ${
                            expired ? styles.statusExpired : styles.statusActive
                          }`}
                        >
                          <span className={styles.statusDot} aria-hidden />
                          {expired ? "Expired" : "Active"}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.actionsCell}>
                          <button
                            type="button"
                            className={
                              copiedId === invite.id
                                ? styles.actionBtnCopied
                                : styles.actionBtn
                            }
                            onClick={() => handleCopyLink(invite)}
                            disabled={revokingId === invite.id}
                            aria-label={`Copy registration link for ${invite.email}`}
                          >
                            {copiedId === invite.id ? (
                              <>
                                <CheckIcon /> Copied!
                              </>
                            ) : (
                              <>
                                <CopyIcon /> Copy Link
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className={styles.revokeBtn}
                            onClick={() => handleRevoke(invite)}
                            disabled={revokingId === invite.id}
                            aria-label={`Revoke invitation for ${invite.email}`}
                          >
                            {revokingId === invite.id ? (
                              <>
                                <span className={styles.spinner} style={{ width: 12, height: 12, borderWidth: 2 }} aria-hidden />
                                Revoking…
                              </>
                            ) : (
                              <>
                                <XIcon /> Revoke
                              </>
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
          <div className={styles.tableFooter}>
            <span className={styles.tableFooterText}>
              {invitations.length} pending{" "}
              {invitations.length === 1 ? "invitation" : "invitations"}
            </span>
          </div>
        </>
      )}

      {/* ── Toast notification ─────────────────────────────── */}
      {toast && (
        <div
          className={
            toast.type === "success" ? styles.toastSuccess : styles.toastError
          }
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

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}
