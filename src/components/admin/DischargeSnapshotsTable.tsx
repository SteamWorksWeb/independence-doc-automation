"use client";

/**
 * src/components/admin/DischargeSnapshotsTable.tsx
 *
 * Interactive client component for the Discharge Snapshots page.
 * Mirrors the Client Pipeline dashboard layout:
 *   • Stat-pill strip (Total, Incomplete, Dischargeable, Not Dischargeable)
 *   • Horizontal filter-tab bar (All | Incomplete | Yes | No)
 *   • Styled data table with badge pills
 *   • "Manage" button per row → centralized action modal (no dropdown)
 *   • Confirmation modals for Archive, Delete, and Change Status
 *
 * Auth / data-fetching stays upstream in the Server Component (page.tsx).
 * This component is purely presentational + interactive.
 */

import React, { useState, useMemo, useEffect } from "react";
import EditSnapshotModal, { SnapshotBorrower } from "@/components/admin/EditSnapshotModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type DischargeFilter = "All" | "Incomplete" | "Yes" | "No" | "Archived";
type ModalType = "manage" | "archive" | "delete" | "status";

interface ActiveModal {
  type: ModalType;
  snapshot: SnapshotBorrower;
}

interface Props {
  initialBorrowers: SnapshotBorrower[];
  fetchError: string | null;
  adminToken: string;
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
  {
    value: "Archived",
    label: "Archived",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
];

const ACTIVE_PILL_STYLES: Record<DischargeFilter, string> = {
  All: "bg-navy text-white shadow-sm",
  Incomplete: "bg-warning text-white shadow-sm",
  Yes: "bg-success text-white shadow-sm",
  No: "bg-text-muted text-white shadow-sm",
  Archived: "bg-[#6b7280] text-white shadow-sm",
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

export default function DischargeSnapshotsTable({ initialBorrowers, fetchError, adminToken }: Props) {
  // Local borrowers state — enables optimistic UI updates for archive/delete/status
  const [borrowers, setBorrowers] = useState<SnapshotBorrower[]>(initialBorrowers);

  const [activeFilter, setActiveFilter] = useState<DischargeFilter>("All");
  const [editBorrower, setEditBorrower] = useState<SnapshotBorrower | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("Incomplete");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Sync if server re-renders with fresh props
  useEffect(() => {
    setBorrowers(initialBorrowers);
  }, [initialBorrowers]);

  // ── Derived counts ──────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const map: Record<DischargeFilter, number> = { All: 0, Incomplete: 0, Yes: 0, No: 0, Archived: 0 };
    for (const b of borrowers) {
      if (b.pipelineStatus === "Archived") {
        map.Archived += 1;
        // Archived records are intentionally excluded from All and sub-counts
        continue;
      }
      map.All += 1;
      if (b.dischargeable === "Incomplete") map.Incomplete += 1;
      else if (b.dischargeable === "Yes") map.Yes += 1;
      else if (b.dischargeable === "No") map.No += 1;
    }
    return map;
  }, [borrowers]);

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      activeFilter === "All"
        ? borrowers.filter((b) => b.pipelineStatus !== "Archived")
        : activeFilter === "Archived"
        ? borrowers.filter((b) => b.pipelineStatus === "Archived")
        : borrowers.filter((b) => b.dischargeable === activeFilter && b.pipelineStatus !== "Archived"),
    [borrowers, activeFilter]
  );

  const hasData = !fetchError && borrowers.length > 0;

  // ── Modal helpers ───────────────────────────────────────────────────────────
  function openModal(type: ModalType, snapshot: SnapshotBorrower) {
    setSelectedStatus(snapshot.dischargeable);
    setActiveModal({ type, snapshot });
  }

  function closeModal() {
    setActiveModal(null);
  }

  async function handleDelete() {
    if (!activeModal) return;
    const snapshotId = activeModal.snapshot.id;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_AWS_API_URL}/admin/discharge-snapshots/${snapshotId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[delete-snapshot] Backend error:", res.status, body);
        alert("Failed to delete borrower. Please try again.");
        return;
      }

      // Success — optimistic removal + close
      setBorrowers((prev) => prev.filter((b) => b.id !== snapshotId));
      closeModal();
    } catch (err) {
      console.error("[delete-snapshot] Network error:", err);
      alert("Failed to delete borrower. Please check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleArchive() {
    if (!activeModal) return;
    const snapshotId = activeModal.snapshot.id;

    setIsSavingStatus(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_AWS_API_URL}/admin/discharge-snapshots/${snapshotId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ status: "Archived" }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[archive-snapshot] Backend error:", res.status, body);
        alert("Failed to archive snapshot. Please try again.");
        return;
      }

      // Success — update pipelineStatus to Archived, leave dischargeable intact
      setBorrowers((prev) =>
        prev.map((b) =>
          b.id === snapshotId ? { ...b, pipelineStatus: "Archived" } : b
        )
      );
      closeModal();
    } catch (err) {
      console.error("[archive-snapshot] Network error:", err);
      alert("Failed to archive snapshot. Please check your connection and try again.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function handleStatusSave() {
    if (!activeModal) return;
    const snapshotId = activeModal.snapshot.id;

    const mapped: SnapshotBorrower["dischargeable"] =
      selectedStatus === "Complete"
        ? "Yes"
        : selectedStatus === "Not Started" || selectedStatus === "Archived"
        ? "No"
        : "Incomplete";

    setIsSavingStatus(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_AWS_API_URL}/admin/discharge-snapshots/${snapshotId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ status: selectedStatus }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[change-status] Backend error:", res.status, body);
        alert("Failed to update status. Please try again.");
        return;
      }

      // Success — update local state and close
      setBorrowers((prev) =>
        prev.map((b) =>
          b.id === snapshotId ? { ...b, dischargeable: mapped } : b
        )
      );
      closeModal();
    } catch (err) {
      console.error("[change-status] Network error:", err);
      alert("Failed to update status. Please check your connection and try again.");
    } finally {
      setIsSavingStatus(false);
    }
  }

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
        {!fetchError && borrowers.length === 0 && (
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
        {hasData && filtered.length > 0 && (
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
                        className="text-navy font-medium transition-[color] duration-150 hover:text-crimson hover:underline cursor-pointer bg-transparent border-none text-left text-[0.9375rem]"
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

                    {/* Action — single Manage button, no dropdown */}
                    <td className="py-3.5 px-4 pr-6 align-middle">
                      <button
                        id={`ds-manage-${borrower.id}`}
                        type="button"
                        onClick={() => openModal("manage", borrower)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md border border-[#2563eb] text-[#2563eb] text-[0.8125rem] font-semibold bg-white hover:bg-[#eff4ff] transition-colors duration-150 cursor-pointer whitespace-nowrap"
                        aria-label={`Manage snapshot for ${borrower.firstName} ${borrower.lastName}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                        </svg>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              Showing {filtered.length} of {borrowers.length}{" "}
              {borrowers.length === 1 ? "snapshot" : "snapshots"}
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

      {/* ═══════════════════════════════════════════════════════════════════════
          MODALS — rendered at fragment root to escape table overflow entirely
          ═══════════════════════════════════════════════════════════════════════ */}

      {/* ── MANAGE modal ─────────────────────────────────────────────────── */}
      {activeModal?.type === "manage" && (
        <ModalOverlay onClose={closeModal}>
          <div className="w-full max-w-[460px] bg-white rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-navy px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-white/60 text-[0.6875rem] font-semibold tracking-[0.07em] uppercase mb-0.5">
                  Manage Snapshot
                </p>
                <h3 className="font-serif font-bold text-white text-[1.125rem] leading-tight">
                  {activeModal.snapshot.firstName} {activeModal.snapshot.lastName}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-white/60 hover:text-white transition-colors duration-150 cursor-pointer mt-0.5 shrink-0"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body — action list */}
            <div className="px-5 py-4 flex flex-col gap-1">

              {/* ── Primary actions ── */}
              <p className="text-[0.625rem] font-bold tracking-[0.08em] uppercase text-text-muted px-1 mb-1">
                Primary Actions
              </p>

              <ManageActionBtn
                icon={<EditIcon />}
                label="Edit Snapshot"
                color="blue"
                onClick={() => {
                  closeModal();
                  setEditBorrower(activeModal.snapshot);
                }}
              />
              <ManageActionBtn
                icon={<PrintIcon />}
                label="Print Snapshot"
                color="default"
                onClick={() => console.log("Action Triggered")}
              />
              <ManageActionBtn
                icon={<DownloadIcon />}
                label="Download Snapshot"
                color="default"
                onClick={() => console.log("Action Triggered")}
              />
              <ManageActionBtn
                icon={<ConvertIcon />}
                label="Convert to Client"
                color="purple"
                onClick={() => console.log("Action Triggered")}
              />

              {/* ── Divider ── */}
              <hr className="my-2 border-border" />

              {/* ── State / admin actions ── */}
              <p className="text-[0.625rem] font-bold tracking-[0.08em] uppercase text-text-muted px-1 mb-1">
                Pipeline Actions
              </p>

              <ManageActionBtn
                icon={<StatusIcon />}
                label="Change Status"
                color="navy"
                onClick={() =>
                  setActiveModal({ type: "status", snapshot: activeModal.snapshot })
                }
              />
              <ManageActionBtn
                icon={<ArchiveIcon />}
                label="Archive Snapshot"
                color="warning"
                onClick={() =>
                  setActiveModal({ type: "archive", snapshot: activeModal.snapshot })
                }
              />

              {/* ── Divider ── */}
              <hr className="my-2 border-border" />

              {/* ── Destructive ── */}
              <ManageActionBtn
                icon={<TrashIcon />}
                label="Delete Snapshot"
                color="danger"
                onClick={() =>
                  setActiveModal({ type: "delete", snapshot: activeModal.snapshot })
                }
              />
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-1">
              <button
                type="button"
                onClick={closeModal}
                className="w-full py-2.5 rounded-lg border border-border text-[0.875rem] font-semibold text-text-secondary bg-white hover:bg-bg transition-colors duration-150 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── DELETE modal ─────────────────────────────────────────────────── */}
      {activeModal?.type === "delete" && (
        <ModalOverlay onClose={closeModal}>
          <div className="w-full max-w-[440px] bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <TrashIcon color="white" />
              </div>
              <h3 className="font-serif font-bold text-white text-[1.0625rem]">
                Permanently Delete Snapshot
              </h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-[0.9rem] text-text-secondary leading-relaxed">
                Are you sure you want to delete the snapshot for{" "}
                <strong className="text-text-primary">
                  {activeModal.snapshot.firstName} {activeModal.snapshot.lastName}
                </strong>
                ? This action cannot be undone and all borrower data will be permanently erased.
              </p>
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveModal({ type: "manage", snapshot: activeModal.snapshot })}
                className="px-5 py-2.5 rounded-lg border border-border text-[0.875rem] font-semibold text-text-secondary bg-white hover:bg-bg transition-colors duration-150 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-[0.875rem] font-bold hover:bg-red-700 transition-colors duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting…" : "Permanently Delete"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── ARCHIVE modal ────────────────────────────────────────────────── */}
      {activeModal?.type === "archive" && (
        <ModalOverlay onClose={closeModal}>
          <div className="w-full max-w-[440px] bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-warning px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <ArchiveIcon color="white" />
              </div>
              <h3 className="font-serif font-bold text-white text-[1.0625rem]">
                Archive Snapshot
              </h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-[0.9rem] text-text-secondary leading-relaxed">
                Archiving the snapshot for{" "}
                <strong className="text-text-primary">
                  {activeModal.snapshot.firstName} {activeModal.snapshot.lastName}
                </strong>{" "}
                will remove it from the active pipeline view. You can restore it later by filtering for archived records.
              </p>
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveModal({ type: "manage", snapshot: activeModal.snapshot })}
                className="px-5 py-2.5 rounded-lg border border-border text-[0.875rem] font-semibold text-text-secondary bg-white hover:bg-bg transition-colors duration-150 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={isSavingStatus}
                className="px-5 py-2.5 rounded-lg bg-warning text-white text-[0.875rem] font-bold hover:bg-[#d97706] transition-colors duration-150 cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingStatus ? "Archiving…" : "Archive Snapshot"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── CHANGE STATUS modal ──────────────────────────────────────────── */}
      {activeModal?.type === "status" && (
        <ModalOverlay onClose={closeModal}>
          <div className="w-full max-w-[440px] bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-navy px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <StatusIcon color="white" />
              </div>
              <h3 className="font-serif font-bold text-white text-[1.0625rem]">
                Override Pipeline Status
              </h3>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <p className="text-[0.9rem] text-text-secondary leading-relaxed">
                Manually set the pipeline status for{" "}
                <strong className="text-text-primary">
                  {activeModal.snapshot.firstName} {activeModal.snapshot.lastName}
                </strong>
                .
              </p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ds-status-select" className="text-[0.8125rem] font-semibold text-text-primary">
                  New Status
                </label>
                <div className="relative">
                  <select
                    id="ds-status-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-[0.875rem] text-text-primary bg-white outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 transition-all duration-150 appearance-none cursor-pointer pr-8"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="Incomplete">Incomplete</option>
                    <option value="Complete">Complete</option>
                    <option value="Archived">Archived</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveModal({ type: "manage", snapshot: activeModal.snapshot })}
                className="px-5 py-2.5 rounded-lg border border-border text-[0.875rem] font-semibold text-text-secondary bg-white hover:bg-bg transition-colors duration-150 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleStatusSave}
                disabled={isSavingStatus}
                className="px-5 py-2.5 rounded-lg bg-[#2563eb] text-white text-[0.875rem] font-bold hover:bg-[#1d4ed8] transition-colors duration-150 cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingStatus ? "Saving…" : "Save Status"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}

// ── Modal Overlay ─────────────────────────────────────────────────────────────

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center px-4"
      style={{ background: "rgba(17,24,39,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}

// ── Manage action button ──────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue:    "text-[#2563eb] hover:bg-[#eff4ff]",
  purple:  "text-[#7c3aed] hover:bg-[#f5f3ff]",
  navy:    "text-navy hover:bg-bg",
  warning: "text-warning hover:bg-warning-bg",
  danger:  "text-red-600 hover:bg-red-50",
  default: "text-text-secondary hover:bg-bg hover:text-navy",
};

function ManageActionBtn({
  icon,
  label,
  color = "default",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[0.875rem] font-semibold cursor-pointer border-none bg-transparent transition-[background,color] duration-150 text-left ${COLOR_MAP[color] ?? COLOR_MAP.default}`}
    >
      <span className="shrink-0 w-4 flex items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ConvertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function StatusIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ArchiveIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function TrashIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
