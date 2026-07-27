"use client";

/**
 * src/components/admin/DischargeSnapshotsTable.tsx
 *
 * Interactive client component for the Discharge Snapshots page.
 * Mirrors the Client Pipeline dashboard layout:
 *   • Stat-pill strip (Total, Incomplete, Dischargeable, Not Dischargeable)
 *   • Horizontal filter-tab bar (All | Incomplete | Yes | No)
 *   • Styled data table with badge pills + Action dropdown
 *   • Edit modal on "View" click
 *
 * Auth / data-fetching stays upstream in the Server Component (page.tsx).
 * This component is purely presentational + interactive.
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import EditSnapshotModal, { SnapshotBorrower } from "@/components/admin/EditSnapshotModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type DischargeFilter = "All" | "Incomplete" | "Yes" | "No";

interface Props {
  initialBorrowers: SnapshotBorrower[];
  fetchError: string | null;
}

// ── Badge / filter config ─────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: DischargeFilter; label: string; icon?: React.ReactElement }[] = [
  { value: "All", label: "All" },
  {
    value: "Incomplete",
    label: "Incomplete",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    value: "Yes",
    label: "Dischargeable",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  {
    value: "No",
    label: "Not Dischargeable",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
];

const ACTIVE_PILL_STYLES: Record<DischargeFilter, string> = {
  All: "bg-navy text-white shadow-sm",
  Incomplete: "bg-warning text-white shadow-sm",
  Yes: "bg-success text-white shadow-sm",
  No: "bg-text-muted text-white shadow-sm",
};

const STATUS_BADGE_STYLES: Record<SnapshotBorrower["dischargeable"], string> = {
  Incomplete: "bg-warning-bg text-warning",
  Yes: "bg-success-bg text-success",
  No: "bg-bg-alt text-text-muted",
};

const STATUS_BADGE_LABELS: Record<SnapshotBorrower["dischargeable"], string> = {
  Incomplete: "Incomplete",
  Yes: "Dischargeable",
  No: "Not Dischargeable",
};

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "navy" | "warning" | "success" | "muted" | "info";
}) {
  const borderMap: Record<string, string> = {
    navy: "border-l-navy",
    warning: "border-l-warning",
    success: "border-l-success",
    muted: "border-l-border",
    info: "border-l-[#2563eb]",
  };
  const valueMap: Record<string, string> = {
    navy: "text-navy",
    warning: "text-warning",
    success: "text-success",
    muted: "text-text-muted",
    info: "text-[#2563eb]",
  };
  return (
    <div
      className={`bg-white border border-border rounded-lg py-4 px-5 flex flex-col gap-1 shadow-sm transition-[box-shadow,transform] duration-200 ease-in-out hover:shadow-md hover:-translate-y-px border-l-[3px] ${borderMap[color]}`}
    >
      <span className={`font-serif text-[1.875rem] font-black leading-none ${valueMap[color]}`}>
        {value}
      </span>
      <span className="text-xs font-semibold tracking-[0.05em] uppercase text-text-muted">
        {label}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DischargeSnapshotsTable({ initialBorrowers, fetchError }: Props) {
  const [activeFilter, setActiveFilter] = useState<DischargeFilter>("All");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [editBorrower, setEditBorrower] = useState<SnapshotBorrower | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [openDropdown]);

  // ── Derived counts ──────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const map: Record<DischargeFilter, number> = { All: 0, Incomplete: 0, Yes: 0, No: 0 };
    for (const b of initialBorrowers) {
      map.All += 1;
      if (b.dischargeable === "Incomplete") map.Incomplete += 1;
      else if (b.dischargeable === "Yes") map.Yes += 1;
      else if (b.dischargeable === "No") map.No += 1;
    }
    return map;
  }, [initialBorrowers]);

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      activeFilter === "All"
        ? initialBorrowers
        : initialBorrowers.filter((b) => b.dischargeable === activeFilter),
    [initialBorrowers, activeFilter]
  );

  const hasData = !fetchError && initialBorrowers.length > 0;

  return (
    <>
      {/* ── Stat pill strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-2 max-[400px]:grid-cols-1 mb-6">
        <StatPill label="Total Borrowers" value={fetchError ? "—" : String(counts.All)} color="navy" />
        <StatPill label="Incomplete" value={fetchError ? "—" : String(counts.Incomplete)} color="warning" />
        <StatPill label="Dischargeable" value={fetchError ? "—" : String(counts.Yes)} color="success" />
        <StatPill label="Not Dischargeable" value={fetchError ? "—" : String(counts.No)} color="muted" />
      </div>

      {/* ── Main table card ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">

        {/* Card header */}
        <div className="flex items-start justify-between py-5 px-6 border-b border-border gap-4 flex-wrap max-[640px]:flex-col">
          <div>
            <h2 className="font-serif text-[1.0625rem] font-bold text-navy mb-0.5">
              Borrower Pipeline
            </h2>
            {!fetchError && (
              <p className="text-[0.8125rem] text-text-muted">
                Filter and manage potential clients
              </p>
            )}
          </div>
        </div>

        {/* ── Error banner ───────────────────────────────────────────────── */}
        {fetchError && (
          <div className="flex items-center gap-3 mx-6 my-5 bg-red-50 border border-red-200 rounded-lg px-5 py-3 text-[0.875rem] text-red-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Could not load snapshots: {fetchError}</span>
          </div>
        )}

        {/* ── Filter bar ─────────────────────────────────────────────────── */}
        {hasData && (
          <div className="flex items-center gap-2 px-6 py-3.5 border-b border-border bg-[#fafbfc] overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <span className="text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted whitespace-nowrap mr-1">
              Filter:
            </span>
            {FILTER_OPTIONS.map((opt) => {
              const isActive = activeFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActiveFilter(opt.value)}
                  className={`inline-flex items-center gap-1.5 py-[5px] px-3 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap border cursor-pointer transition-all duration-150 ease-in-out ${
                    isActive
                      ? `${ACTIVE_PILL_STYLES[opt.value]} border-transparent`
                      : "bg-white border-border text-text-secondary hover:border-navy hover:text-navy"
                  }`}
                  aria-pressed={isActive}
                >
                  {opt.icon}
                  {opt.label}
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.625rem] font-bold leading-none ${
                      isActive ? "bg-white/20 text-white" : "bg-bg-alt text-text-muted"
                    }`}
                  >
                    {counts[opt.value]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!fetchError && initialBorrowers.length === 0 && (
          <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
            <div className="w-[68px] h-[68px] rounded-full bg-bg flex items-center justify-center text-text-muted mb-1">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="font-serif text-[1.0625rem] font-bold text-text-primary">No snapshots yet</p>
            <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">
              Discharge snapshots will appear here once borrowers are submitted through the wizard.
            </p>
          </div>
        )}

        {/* ── Filtered-empty state ────────────────────────────────────────── */}
        {hasData && filtered.length === 0 && (
          <div className="flex flex-col items-center text-center py-12 px-6 gap-2">
            <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center text-text-muted mb-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <p className="font-serif text-sm font-bold text-text-primary">
              No snapshots match &ldquo;{FILTER_OPTIONS.find((o) => o.value === activeFilter)?.label}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setActiveFilter("All")}
              className="text-xs font-semibold text-crimson hover:underline cursor-pointer bg-transparent border-none"
            >
              Clear filter →
            </button>
          </div>
        )}

        {/* ── Data table ─────────────────────────────────────────────────── */}
        {/* Outer div is overflow-visible so the Action dropdown can escape the
             card's bounding box without creating a scrollbar. The inner div
             handles horizontal scroll for narrow viewports. */}
        {hasData && filtered.length > 0 && (
          <div className="overflow-visible">
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table
              className="w-full border-collapse text-sm min-w-[720px]"
              aria-label="Discharge snapshots"
            >
              <thead>
                <tr>
                  {["#", "Borrower", "Submitted", "Last Updated", "Status", "Action"].map((h, i) => (
                    <th
                      key={h}
                      className={`py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none ${i === 0 ? "pl-6" : ""} ${i === 5 ? "pr-6" : ""}`}
                      scope="col"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((borrower, index) => (
                  <tr
                    key={borrower.id}
                    className="border-b border-border last:border-b-0 transition-[background] duration-150 hover:bg-[#fafbfc]"
                  >
                    {/* # */}
                    <td className="py-3.5 px-4 pl-6 text-text-muted text-[0.8125rem] font-medium w-10 align-middle">
                      {index + 1}
                    </td>

                    {/* Borrower name */}
                    <td className="py-3.5 px-4 font-medium align-middle">
                      <button
                        id={`ds-row-${borrower.id}`}
                        type="button"
                        onClick={() => setEditBorrower(borrower)}
                        className="text-navy font-medium no-underline transition-[color] duration-150 hover:text-crimson hover:underline cursor-pointer bg-transparent border-none text-left text-[0.9375rem]"
                      >
                        {borrower.lastName}, {borrower.firstName}
                      </button>
                    </td>

                    {/* Submitted (created) */}
                    <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap align-middle text-[0.8125rem]">
                      <div>{borrower.created}</div>
                      {borrower.createdBy !== "—" && (
                        <div className="text-[0.75rem] text-text-muted mt-0.5">
                          By: {borrower.createdBy}
                        </div>
                      )}
                    </td>

                    {/* Last updated */}
                    <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap align-middle text-[0.8125rem]">
                      <div>{borrower.lastUpdated}</div>
                      {borrower.lastUpdatedBy !== "—" && (
                        <div className="text-[0.75rem] text-text-muted mt-0.5">
                          By: {borrower.lastUpdatedBy}
                        </div>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-4 align-middle">
                      <span
                        className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${STATUS_BADGE_STYLES[borrower.dischargeable]}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80" aria-hidden />
                        {STATUS_BADGE_LABELS[borrower.dischargeable]}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 pr-6 align-middle">
                      <SnapshotActionCell
                        borrower={borrower}
                        isOpen={openDropdown === borrower.id}
                        onToggle={() =>
                          setOpenDropdown(openDropdown === borrower.id ? null : borrower.id)
                        }
                        onView={() => {
                          setOpenDropdown(null);
                          setEditBorrower(borrower);
                        }}
                        dropdownRef={openDropdown === borrower.id ? dropdownRef : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {/* ── Table footer ───────────────────────────────────────────────── */}
        {hasData && filtered.length > 0 && (
          <div className="py-3 px-6 border-t border-border bg-bg flex items-center justify-between">
            <span className="text-[0.8125rem] text-text-muted">
              {activeFilter !== "All" && (
                <>
                  Filtered: <strong className="text-text-primary">{FILTER_OPTIONS.find((o) => o.value === activeFilter)?.label}</strong> ·{" "}
                </>
              )}
              Showing {filtered.length} of {initialBorrowers.length}{" "}
              {initialBorrowers.length === 1 ? "snapshot" : "snapshots"}
            </span>
            {activeFilter !== "All" && (
              <button
                type="button"
                onClick={() => setActiveFilter("All")}
                className="text-xs font-semibold text-crimson hover:underline cursor-pointer bg-transparent border-none"
              >
                Show all →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editBorrower && (
        <EditSnapshotModal
          borrower={editBorrower}
          onClose={() => setEditBorrower(null)}
        />
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SnapshotActionCell({
  borrower,
  isOpen,
  onToggle,
  onView,
  dropdownRef,
}: {
  borrower: SnapshotBorrower;
  isOpen: boolean;
  onToggle: () => void;
  onView: () => void;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex items-center gap-2" ref={dropdownRef}>
      {/* View / edit */}
      <button
        id={`ds-view-${borrower.id}`}
        type="button"
        onClick={onView}
        className="text-[0.8125rem] font-semibold text-crimson no-underline whitespace-nowrap transition-[color] duration-150 hover:text-crimson hover:underline cursor-pointer bg-transparent border-none"
        aria-label={`View snapshot for ${borrower.firstName} ${borrower.lastName}`}
      >
        View
      </button>

      {/* Chevron dropdown (PDF download when dischargeable) */}
      <div className="relative">
        <button
          type="button"
          id={`ds-menu-trigger-${borrower.id}`}
          onClick={onToggle}
          className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-md border border-border bg-white text-text-secondary cursor-pointer transition-all duration-150 ease-in-out hover:bg-bg hover:border-navy hover:text-navy"
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label={`Actions for ${borrower.firstName} ${borrower.lastName}`}
        >
          <ChevronDownIcon />
        </button>

        {isOpen && (
          <div
            className="absolute right-0 top-[calc(100%+4px)] z-[200] min-w-[200px] bg-white rounded-lg border border-border shadow-lg py-1 animate-fade-in"
            role="menu"
            aria-labelledby={`ds-menu-trigger-${borrower.id}`}
          >
            <div className="px-3 py-2 border-b border-border">
              <span className="text-[0.625rem] font-bold tracking-[0.08em] uppercase text-text-muted">
                Actions
              </span>
            </div>

            {/* Edit Snapshot */}
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold cursor-pointer border-none bg-transparent transition-[background,color] duration-150 text-[#2563eb] hover:bg-[#eff4ff]"
              onClick={onView}
            >
              Edit Snapshot
            </button>

            {/* Print Snapshot */}
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold cursor-pointer border-none bg-transparent transition-[background,color] duration-150 text-text-secondary hover:bg-bg hover:text-navy inline-flex items-center gap-2"
              onClick={() => console.log('Action Triggered')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Snapshot
            </button>

            {/* Convert to Client */}
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold cursor-pointer border-none bg-transparent transition-[background,color] duration-150 text-[#7c3aed] hover:bg-[#f5f3ff] inline-flex items-center gap-2"
              onClick={() => console.log('Action Triggered')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              Convert to Client
            </button>

            {/* Download Snapshot */}
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold cursor-pointer border-none bg-transparent transition-[background,color] duration-150 text-success hover:bg-success-bg inline-flex items-center gap-2"
              onClick={() => console.log('Action Triggered')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Snapshot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
