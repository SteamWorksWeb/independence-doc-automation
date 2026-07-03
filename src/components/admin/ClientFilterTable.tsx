/**
 * src/components/admin/ClientFilterTable.tsx
 *
 * Interactive, filterable client table for the Client Directory.
 *
 * Receives the full list of clients (server-fetched) and implements
 * client-side filtering with pill-style status filter buttons.
 *
 * Pipeline statuses: Intake Pending → Ready for Review → Approved → Rejected
 *
 * The Action column provides a dropdown to update a client's pipeline status
 * via PATCH /admin/clients/:id/status.
 */

"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClientStatus =
  | "Intake Pending"
  | "Ready for Review"
  | "Approved"
  | "Rejected";

export interface ClientRow {
  id: string;
  email: string;
  createdAt: string;
  isVerified: boolean;
  intakeProfile: { isCompleted: boolean; [key: string]: unknown } | null;
  status: ClientStatus;
}

type FilterOption = "All" | ClientStatus;

interface ClientFilterTableProps {
  clients: ClientRow[];
  adminToken: string;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

// ── Status transition map (context-aware actions per status) ──────────────────

const STATUS_TRANSITIONS: Record<ClientStatus, { label: string; target: ClientStatus; style: string }[]> = {
  "Intake Pending": [
    { label: "Mark Ready for Review", target: "Ready for Review", style: "text-[#2563eb] hover:bg-[#eff4ff]" },
  ],
  "Ready for Review": [
    { label: "Approve", target: "Approved", style: "text-success hover:bg-success-bg" },
    { label: "Reject", target: "Rejected", style: "text-crimson hover:bg-crimson-light" },
  ],
  Approved: [
    { label: "Revert to Review", target: "Ready for Review", style: "text-[#2563eb] hover:bg-[#eff4ff]" },
    { label: "Reject", target: "Rejected", style: "text-crimson hover:bg-crimson-light" },
  ],
  Rejected: [
    { label: "Revert to Review", target: "Ready for Review", style: "text-[#2563eb] hover:bg-[#eff4ff]" },
    { label: "Approve", target: "Approved", style: "text-success hover:bg-success-bg" },
  ],
};

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

function obfuscateEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  const dots = "•".repeat(Math.max(0, local.length - 3));
  return `${visible}${dots}@${domain}`;
}

// ── Filter pill config ────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: FilterOption; label: string; icon?: React.ReactElement }[] = [
  { value: "All", label: "All" },
  {
    value: "Intake Pending",
    label: "Intake Pending",
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  },
  {
    value: "Ready for Review",
    label: "Ready for Review",
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  },
  {
    value: "Approved",
    label: "Approved",
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>,
  },
  {
    value: "Rejected",
    label: "Rejected",
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  },
];

// Active filter pill styling per status
const ACTIVE_PILL_STYLES: Record<FilterOption, string> = {
  All: "bg-navy text-white shadow-sm",
  "Intake Pending": "bg-warning text-white shadow-sm",
  "Ready for Review": "bg-[#2563eb] text-white shadow-sm",
  Approved: "bg-success text-white shadow-sm",
  Rejected: "bg-text-muted text-white shadow-sm",
};

// ── Status badge color map ────────────────────────────────────────────────────

const STATUS_BADGE_STYLES: Record<ClientStatus, string> = {
  "Intake Pending": "bg-warning-bg text-warning",
  "Ready for Review": "bg-[#eff4ff] text-[#2563eb]",
  Approved: "bg-success-bg text-success",
  Rejected: "bg-bg-alt text-text-muted",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientFilterTable({ clients: initialClients, adminToken }: ClientFilterTableProps) {
  const [clients, setClients] = useState<ClientRow[]>(initialClients);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync with server data if it changes (e.g. page re-render)
  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    if (openDropdown) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [openDropdown]);

  // ── Status change handler ─────────────────────────────────────────────────

  const handleStatusChange = useCallback(
    async (clientId: string, newStatus: ClientStatus) => {
      if (updatingId) return;

      setUpdatingId(clientId);
      setOpenDropdown(null);

      // Store original state for rollback
      const previousClients = [...clients];

      // Optimistic update
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
      );

      try {
        const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
        const res = await fetch(`${apiUrl}/admin/clients/${clientId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as Record<string, string>).error ||
            (body as Record<string, string>).message ||
            `Server responded with ${res.status}`
          );
        }

        const clientEmail =
          clients.find((c) => c.id === clientId)?.email ?? "Client";
        setToast({
          message: `${clientEmail} → ${newStatus}`,
          type: "success",
        });
      } catch (err) {
        // Rollback on failure
        setClients(previousClients);
        setToast({
          message: err instanceof Error ? err.message : "Failed to update status.",
          type: "error",
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [adminToken, clients, updatingId]
  );

  // Derive counts per status (always from full list)
  const counts = useMemo(() => {
    const map: Record<FilterOption, number> = {
      All: clients.length,
      "Intake Pending": 0,
      "Ready for Review": 0,
      Approved: 0,
      Rejected: 0,
    };
    for (const c of clients) {
      map[c.status] = (map[c.status] ?? 0) + 1;
    }
    return map;
  }, [clients]);

  // Filtered client list
  const filtered = useMemo(
    () => activeFilter === "All" ? clients : clients.filter((c) => c.status === activeFilter),
    [clients, activeFilter]
  );

  return (
    <>
      {/* ── Filter bar ──────────────────────────────────────── */}
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
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-bg-alt text-text-muted"
                }`}
              >
                {counts[opt.value]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Empty filter state ──────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center text-center py-12 px-6 gap-2">
          <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center text-text-muted mb-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="font-serif text-sm font-bold text-text-primary">
            No clients match &ldquo;{activeFilter}&rdquo;
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

      {/* ── Data table ──────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full border-collapse text-sm min-w-[720px]" aria-label="Client directory">
            <thead>
              <tr>
                {["#", "Client Email", "Joined Date", "Status", "Intake", "Action"].map((h, i) => (
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
              {filtered.map((client, index) => (
                <tr
                  key={client.id}
                  className="border-b border-border last:border-b-0 transition-[background] duration-fast hover:bg-[#fafbfc]"
                >
                  <td className="py-3.5 px-4 pl-6 text-text-muted text-[0.8125rem] font-medium w-10 align-middle">
                    {index + 1}
                  </td>
                  <td className="py-3.5 px-4 font-medium max-w-[280px] align-middle">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="text-navy no-underline font-medium transition-[color] duration-fast hover:text-crimson hover:underline"
                      title={client.email}
                    >
                      <span className="inline max-[640px]:hidden">{client.email}</span>
                      <span className="hidden max-[640px]:inline" aria-hidden>
                        {obfuscateEmail(client.email)}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap align-middle">
                    {formatDate(client.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 align-middle">
                    <span
                      className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${STATUS_BADGE_STYLES[client.status]}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80" aria-hidden />
                      {client.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 align-middle">
                    <IntakeIndicator client={client} />
                  </td>
                  <td className="py-3.5 px-4 pr-6 align-middle">
                    <StatusActionCell
                      client={client}
                      isOpen={openDropdown === client.id}
                      isUpdating={updatingId === client.id}
                      onToggle={() => setOpenDropdown(openDropdown === client.id ? null : client.id)}
                      onStatusChange={handleStatusChange}
                      dropdownRef={openDropdown === client.id ? dropdownRef : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Table footer ────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="py-3 px-6 border-t border-border bg-bg flex items-center justify-between">
          <span className="text-[0.8125rem] text-text-muted">
            {activeFilter !== "All" && (
              <>Filtered: <strong className="text-text-primary">{activeFilter}</strong> · </>
            )}
            Showing {filtered.length} of {clients.length} {clients.length === 1 ? "client" : "clients"}
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

      {/* ── Toast notification ──────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 flex items-center gap-2 text-white py-3 px-5 rounded-lg font-sans text-[0.8125rem] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.18)] z-[1000] animate-toast-in ${
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

// ── Sub-components ────────────────────────────────────────────────────────────

/** Per-row action cell: View link + status dropdown */
function StatusActionCell({
  client,
  isOpen,
  isUpdating,
  onToggle,
  onStatusChange,
  dropdownRef,
}: {
  client: ClientRow;
  isOpen: boolean;
  isUpdating: boolean;
  onToggle: () => void;
  onStatusChange: (clientId: string, newStatus: ClientStatus) => void;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const transitions = STATUS_TRANSITIONS[client.status] ?? [];

  return (
    <div className="flex items-center gap-2" ref={dropdownRef}>
      {/* View profile link */}
      <Link
        href={`/admin/clients/${client.id}`}
        className="text-[0.8125rem] font-semibold text-crimson no-underline whitespace-nowrap transition-[color] duration-fast hover:text-crimson-hover hover:underline"
        aria-label={`View profile for ${client.email}`}
      >
        View
      </Link>

      {/* Status dropdown trigger */}
      {transitions.length > 0 && (
        <div className="relative">
          <button
            type="button"
            id={`status-menu-trigger-${client.id}`}
            onClick={onToggle}
            disabled={isUpdating}
            className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-md border border-border bg-white text-text-secondary cursor-pointer transition-all duration-150 ease-in-out hover:bg-bg hover:border-navy hover:text-navy disabled:opacity-50 disabled:cursor-not-allowed"
            aria-haspopup="true"
            aria-expanded={isOpen}
            aria-label={`Change status for ${client.email}`}
          >
            {isUpdating ? (
              <span className="w-3.5 h-3.5 border-2 border-border border-t-crimson rounded-full animate-spin" aria-hidden />
            ) : (
              <ChevronDownIcon />
            )}
          </button>

          {/* Dropdown menu */}
          {isOpen && !isUpdating && (
            <div
              className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[180px] bg-white rounded-lg border border-border shadow-lg py-1 animate-fade-in"
              role="menu"
              aria-labelledby={`status-menu-trigger-${client.id}`}
            >
              <div className="px-3 py-2 border-b border-border">
                <span className="text-[0.625rem] font-bold tracking-[0.08em] uppercase text-text-muted">
                  Move to
                </span>
              </div>
              {transitions.map((t) => (
                <button
                  key={t.target}
                  type="button"
                  role="menuitem"
                  className={`w-full text-left px-3 py-2 text-[0.8125rem] font-semibold cursor-pointer border-none bg-transparent transition-[background,color] duration-150 ease-in-out ${t.style}`}
                  onClick={() => onStatusChange(client.id, t.target)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IntakeIndicator({ client }: { client: ClientRow }) {
  if (!client.isVerified) return <span className="text-[0.8125rem] font-medium text-text-muted">N/A</span>;
  if (!client.intakeProfile) return <span className="text-[0.8125rem] font-medium text-text-muted">Not started</span>;
  if (!client.intakeProfile.isCompleted) return <span className="text-[0.8125rem] font-medium text-warning">In progress</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-success">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
      Complete
    </span>
  );
}

// ── Inline SVG Icons ────────────────────────────────────────────────────────

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
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

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
