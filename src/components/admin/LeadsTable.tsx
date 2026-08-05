"use client";

/**
 * src/components/admin/LeadsTable.tsx
 *
 * Interactive table for the Leads directory.
 * Shows invited borrowers (userType === "LEAD") with their intake status.
 * Provides:
 *   - Search by name / email
 *   - "Promote to Client" button (calls POST /admin/leads/:id/promote)
 *   - "Delete" button (calls DELETE /admin/leads/:id)
 */

import { useState, useMemo, useTransition } from "react";
import type { Lead } from "@/app/admin/leads/page";

interface LeadsTableProps {
  leads:      Lead[];
  fetchError: string | null;
  adminToken: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return "—"; }
}

function IntakeBadge({ lead }: { lead: Lead }) {
  const done = lead.intakeProfile?.isCompleted || lead.intakeStatus === "Complete";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.75rem] font-semibold ${
        done
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-amber-400"}`} />
      {done ? "Complete" : "Incomplete"}
    </span>
  );
}

export default function LeadsTable({ leads, fetchError, adminToken }: LeadsTableProps) {
  const [search,  setSearch]  = useState("");
  const [rows,    setRows]    = useState<Lead[]>(leads);
  const [error,   setError]   = useState<string | null>(fetchError);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (l) =>
        (l.name ?? "").toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL ?? "";

  async function handlePromote(lead: Lead) {
    if (!confirm(`Promote "${lead.name ?? lead.email}" to Client?\n\nThis will move them to the Client Directory with status "Pre-Filing".`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`${backendBase}/admin/leads/${lead.id}/promote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError((d as { error?: string }).error ?? "Failed to promote lead.");
          return;
        }
        setRows((prev) => prev.filter((l) => l.id !== lead.id));
        setError(null);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  async function handleDelete(lead: Lead) {
    if (!confirm(`Permanently delete lead "${lead.name ?? lead.email}"?\n\nThis cannot be undone.`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`${backendBase}/admin/leads/${lead.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError((d as { error?: string }).error ?? "Failed to delete lead.");
          return;
        }
        setRows((prev) => prev.filter((l) => l.id !== lead.id));
        setError(null);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">

      {/* ── Card header + search ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 py-4 px-6 border-b border-border flex-wrap max-[640px]:flex-col">
        <div>
          <h2 className="font-serif text-[1.0625rem] font-bold text-navy mb-0.5">Lead Directory</h2>
          <p className="text-[0.8125rem] text-text-muted">
            {rows.length === 0 ? "No leads found." : `${rows.length} lead${rows.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-navy/20 w-[260px] max-[640px]:w-full"
        />
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[0.875rem] text-red-700">
          {error}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!error && filtered.length === 0 && (
        <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
          <div className="w-16 h-16 rounded-full bg-bg flex items-center justify-center text-text-muted mb-1">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <p className="font-serif text-[1.0625rem] font-bold text-text-primary">
            {search ? "No leads match your search" : "No leads yet"}
          </p>
          <p className="text-[0.9rem] text-text-muted max-w-[340px]">
            {search
              ? "Try a different name or email address."
              : "Invite a borrower to start the intake flow. They will appear here until promoted to Client."}
          </p>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg">
                <th className="text-left py-3 px-6 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-text-muted w-[40px]">#</th>
                <th className="text-left py-3 px-4 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-text-muted">Lead</th>
                <th className="text-left py-3 px-4 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-text-muted">Intake Status</th>
                <th className="text-left py-3 px-4 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-text-muted">Date Added</th>
                <th className="text-left py-3 px-4 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-text-muted">Assigned To</th>
                <th className="text-right py-3 px-6 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((lead, idx) => (
                <tr key={lead.id} className="hover:bg-bg/60 transition-colors">
                  <td className="py-4 px-6 text-text-muted text-[0.8125rem]">{idx + 1}</td>
                  <td className="py-4 px-4">
                    <p className="font-semibold text-text-primary text-[0.9375rem]">
                      {lead.name ?? "—"}
                    </p>
                    <p className="text-[0.8125rem] text-text-muted">{lead.email}</p>
                    {lead.intakeProfile?.phone && (
                      <p className="text-[0.8125rem] text-text-muted">{lead.intakeProfile.phone}</p>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <IntakeBadge lead={lead} />
                  </td>
                  <td className="py-4 px-4 text-[0.875rem] text-text-muted whitespace-nowrap">
                    {formatDate(lead.createdAt)}
                  </td>
                  <td className="py-4 px-4 text-[0.875rem] text-text-muted">
                    {lead.assigneeName ?? <span className="text-text-muted/50 italic">Unassigned</span>}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => handlePromote(lead)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-[0.8125rem] font-semibold hover:bg-navy/90 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                        Promote to Client
                      </button>
                      <button
                        onClick={() => handleDelete(lead)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-[0.8125rem] font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                        title="Delete lead"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
