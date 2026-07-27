"use client";

/**
 * src/components/admin/DischargeSnapshotsTable.tsx
 *
 * Interactive client component for the Discharge Snapshots page.
 * Receives pre-fetched borrower data from the parent Server Component
 * and handles: client-side search filtering, row click → edit modal.
 *
 * Auth is handled upstream (Server Component reads admin_session cookie
 * and fetches with a Bearer token). This component never touches auth.
 */

import React, { useState, useMemo } from "react";
import EditSnapshotModal, { SnapshotBorrower } from "@/components/admin/EditSnapshotModal";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialBorrowers: SnapshotBorrower[];
  fetchError: string | null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-left text-[0.6875rem] font-semibold text-[#6b7280] tracking-[0.08em] uppercase whitespace-nowrap">
      {children}
    </th>
  );
}

function TimeCell({ timestamp, by }: { timestamp: string; by: string }) {
  return (
    <div>
      <div className="text-[0.875rem] text-[#374151]">{timestamp}</div>
      {by !== "—" && (
        <div className="text-[0.75rem] text-[#9ca3af] mt-0.5">By: {by}</div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DischargeSnapshotsTable({ initialBorrowers, fetchError }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [query, setQuery] = useState<{ first: string; last: string } | null>(null);
  const [editBorrower, setEditBorrower] = useState<SnapshotBorrower | null>(null);

  // ── Client-side search filter ──────────────────────────────────────────────
  const rows = useMemo(() => {
    if (!query) return initialBorrowers;
    return initialBorrowers.filter((b) => {
      const fnMatch = !query.first || b.firstName.toLowerCase().includes(query.first.toLowerCase());
      const lnMatch = !query.last || b.lastName.toLowerCase().includes(query.last.toLowerCase());
      return fnMatch && lnMatch;
    });
  }, [query, initialBorrowers]);

  function handleSearch() {
    setQuery({ first: firstName.trim(), last: lastName.trim() });
  }

  return (
    <>
      {/* ── Search box ──────────────────────────────────────────────────── */}
      <div className="bg-[#f1f3f6] rounded-lg px-6 py-5 flex items-center gap-4 mb-8">
        <input
          id="ds-first-name"
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1 bg-white border border-[#dde2ea] rounded px-4 py-3 text-[0.9375rem] text-[#1a2744] placeholder:text-[#9ca3af] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/15 transition-all duration-150"
        />
        <input
          id="ds-last-name"
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1 bg-white border border-[#dde2ea] rounded px-4 py-3 text-[0.9375rem] text-[#1a2744] placeholder:text-[#9ca3af] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/15 transition-all duration-150"
        />
        <button
          id="ds-search-btn"
          onClick={handleSearch}
          className="px-10 py-3 bg-[#1d4ed8] text-white font-bold text-[0.9375rem] tracking-widest uppercase rounded hover:bg-[#1e40af] transition-colors duration-150 cursor-pointer shadow-sm whitespace-nowrap"
        >
          SEARCH
        </button>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-5 py-3 text-[0.875rem] text-red-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Could not load snapshots: {fetchError}</span>
        </div>
      )}

      {/* ── Data grid ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
              <ColHeader>Borrower</ColHeader>
              <ColHeader>Created</ColHeader>
              <ColHeader>Last Updated</ColHeader>
              <ColHeader>Dischargeable?</ColHeader>
              {/* Extra column for Download button alignment */}
              <th className="w-[160px]" />
            </tr>
          </thead>
          <tbody>
            {/* Empty state */}
            {rows.length === 0 && !fetchError && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[0.875rem] text-[#9ca3af]">
                  {query
                    ? "No borrowers match your search."
                    : "No discharge snapshots found."}
                </td>
              </tr>
            )}

            {/* Data rows */}
            {rows.map((borrower) => (
              <tr
                key={borrower.id}
                className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafbfc] transition-colors duration-100"
              >
                {/* Borrower name — clickable link */}
                <td className="px-5 py-4">
                  <button
                    id={`ds-row-${borrower.id}`}
                    onClick={() => setEditBorrower(borrower)}
                    className="text-[0.9375rem] font-medium text-[#1d4ed8] hover:text-[#b31e3c] hover:underline transition-colors duration-150 cursor-pointer text-left"
                  >
                    {borrower.lastName}, {borrower.firstName}
                  </button>
                </td>

                {/* Created */}
                <td className="px-5 py-4">
                  <TimeCell timestamp={borrower.created} by={borrower.createdBy} />
                </td>

                {/* Last Updated */}
                <td className="px-5 py-4">
                  <TimeCell timestamp={borrower.lastUpdated} by={borrower.lastUpdatedBy} />
                </td>

                {/* Dischargeable status */}
                <td className="px-5 py-4 text-[0.875rem] text-[#374151]">
                  {borrower.dischargeable}
                </td>

                {/* Download button (only when dischargeable is "Yes") */}
                <td className="px-5 py-4 text-right">
                  {borrower.dischargeable === "Yes" && (
                    <button
                      id={`ds-download-${borrower.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-[#1d4ed8] text-[#1d4ed8] text-[0.8125rem] font-semibold rounded hover:bg-[#1d4ed8] hover:text-white transition-colors duration-150 cursor-pointer"
                    >
                      <DownloadIcon />
                      Download
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Edit Modal ──────────────────────────────────────────────────── */}
      {editBorrower && (
        <EditSnapshotModal
          borrower={editBorrower}
          onClose={() => setEditBorrower(null)}
        />
      )}
    </>
  );
}
