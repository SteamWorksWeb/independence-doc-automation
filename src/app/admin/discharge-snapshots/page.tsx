"use client";

/**
 * src/app/admin/discharge-snapshots/page.tsx
 *
 * "View Existing" page for the Discharge SnapShot tool.
 * Route: /admin/discharge-snapshots
 *
 * Features:
 *  - Page heading "Borrowers"
 *  - First Name / Last Name search box + SEARCH button
 *  - Data grid: BORROWER | CREATED | LAST UPDATED | DISCHARGEABLE?
 *  - Live data fetched from GET /api/v1/admin/discharge-snapshots
 *  - Clicking borrower name opens EditSnapshotModal slide-out drawer
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import EditSnapshotModal, { SnapshotBorrower } from "@/components/admin/EditSnapshotModal";

// ── API response shape ────────────────────────────────────────────────────────

interface ApiSnapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  isDischargeable: boolean | null;
  status?: string;
  lowestMonthlyPayment?: number | string | null;
  client: {
    firstName: string;
    lastName: string;
  };
  /** Optional: if the backend embeds admin user info for audit trail */
  createdByUser?: { firstName?: string; lastName?: string; name?: string } | null;
  updatedByUser?: { firstName?: string; lastName?: string; name?: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format an ISO timestamp → "MM-DD-YYYY HH:MM:SS AM/PM (ET)" */
function formatTimestamp(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    // Display in Eastern Time
    return d.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).replace(",", "") + " (ET)";
  } catch {
    return iso;
  }
}

/** Resolve the user display name from an embedded user object */
function resolveUserName(
  userObj?: { firstName?: string; lastName?: string; name?: string } | null
): string {
  if (!userObj) return "—";
  if (userObj.firstName || userObj.lastName) {
    return [userObj.firstName, userObj.lastName].filter(Boolean).join(" ");
  }
  return userObj.name ?? "—";
}

/** Map a raw API snapshot to the SnapshotBorrower shape the UI/modal expect */
function mapSnapshot(snap: ApiSnapshot): SnapshotBorrower {
  // Determine dischargeable label
  let dischargeable: SnapshotBorrower["dischargeable"] = "Incomplete";
  if (snap.isDischargeable === true || snap.status === "dischargeable") {
    dischargeable = "Yes";
  } else if (snap.isDischargeable === false || snap.status === "not_dischargeable") {
    dischargeable = "No";
  }

  // Lowest monthly payment → dollar string
  let lowestMonthlyPayment: string | undefined;
  if (snap.lowestMonthlyPayment != null) {
    const raw = Number(snap.lowestMonthlyPayment);
    if (!isNaN(raw)) {
      lowestMonthlyPayment = `$${raw.toFixed(2)}`;
    } else {
      lowestMonthlyPayment = String(snap.lowestMonthlyPayment);
    }
  }

  return {
    id: snap.id,
    firstName: snap.client.firstName,
    lastName: snap.client.lastName,
    created: formatTimestamp(snap.createdAt),
    createdBy: resolveUserName(snap.createdByUser),
    lastUpdated: formatTimestamp(snap.updatedAt),
    lastUpdatedBy: resolveUserName(snap.updatedByUser),
    dischargeable,
    lowestMonthlyPayment,
  };
}

// ── Column header ─────────────────────────────────────────────────────────────

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-left text-[0.6875rem] font-semibold text-[#6b7280] tracking-[0.08em] uppercase whitespace-nowrap">
      {children}
    </th>
  );
}

// ── Timestamp cell ────────────────────────────────────────────────────────────

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

// ── Download icon ─────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DischargeSnapshotsPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");;
  const [query, setQuery] = useState<{ first: string; last: string } | null>(null);
  const [editBorrower, setEditBorrower] = useState<SnapshotBorrower | null>(null);

  // ── Live data state ────────────────────────────────────────────────────────
  const [allBorrowers, setAllBorrowers] = useState<SnapshotBorrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_AWS_API_URL}/api/v1/admin/discharge-snapshots`,
        {
          credentials: "include", // sends admin_session cookie automatically
          cache: "no-store",
        }
      );
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      const data = await res.json();
      // Support both { snapshots: [...] } and a bare array
      const raw: ApiSnapshot[] = Array.isArray(data)
        ? data
        : Array.isArray(data.snapshots)
        ? data.snapshots
        : [];
      setAllBorrowers(raw.map(mapSnapshot));
    } catch (err) {
      console.error("[DischargeSnapshots] fetch error:", err);
      setFetchError(
        err instanceof Error ? err.message : "Failed to load snapshots."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // ── Client-side search filter ──────────────────────────────────────────────
  const rows = useMemo(() => {
    if (!query) return allBorrowers;
    return allBorrowers.filter((b) => {
      const fnMatch = !query.first || b.firstName.toLowerCase().includes(query.first.toLowerCase());
      const lnMatch = !query.last || b.lastName.toLowerCase().includes(query.last.toLowerCase());
      return fnMatch && lnMatch;
    });
  }, [query, allBorrowers]);

  function handleSearch() {
    setQuery({ first: firstName.trim(), last: lastName.trim() });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page heading ────────────────────────────────────────────────── */}
      <h1 className="text-center font-sans font-bold text-[1.75rem] text-[#1d4ed8] mb-6">
        Borrowers
      </h1>

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
          <button
            onClick={fetchSnapshots}
            className="ml-auto text-red-700 underline hover:no-underline cursor-pointer"
          >
            Retry
          </button>
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
            {/* Loading skeleton */}
            {loading && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[0.875rem] text-[#9ca3af]">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeOpacity="0.25"/>
                      <path d="M21 12a9 9 0 0 1-9 9" strokeLinecap="round"/>
                    </svg>
                    Loading snapshots…
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state (after load, no error) */}
            {!loading && !fetchError && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[0.875rem] text-[#9ca3af]">
                  {query
                    ? "No borrowers match your search."
                    : "No discharge snapshots found."}
                </td>
              </tr>
            )}

            {/* Data rows */}
            {!loading && rows.map((borrower) => (
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
