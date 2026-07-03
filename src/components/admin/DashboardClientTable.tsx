/**
 * src/components/admin/DashboardClientTable.tsx
 *
 * Client Component — Interactive, filterable client table for the Dashboard
 * (Client Roster) page.
 *
 * Receives the full list of clients (server-fetched) and implements
 * client-side filtering with pill-style status filter tabs.
 *
 * Statuses: Pending Email Verification · Intake Pending · Ready for Review
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type ClientStatus =
  | "Pending Email Verification"
  | "Intake Pending"
  | "Ready for Review";

interface IntakeProfile {
  isCompleted: boolean;
  [key: string]: unknown;
}

export interface DashboardClientRow {
  id: string;
  email: string;
  createdAt: string;
  isVerified: boolean;
  intakeProfile: IntakeProfile | null;
  status: ClientStatus;
}

type FilterOption = "All" | ClientStatus;

interface DashboardClientTableProps {
  clients: DashboardClientRow[];
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

function obfuscateEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  const dots = "•".repeat(Math.max(0, local.length - 3));
  return `${visible}${dots}@${domain}`;
}

// ── Filter config ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: FilterOption; label: string; icon?: React.ReactElement }[] = [
  { value: "All", label: "All" },
  {
    value: "Ready for Review",
    label: "Ready for Review",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  {
    value: "Intake Pending",
    label: "Intake Pending",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    value: "Pending Email Verification",
    label: "Unverified",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" />
      </svg>
    ),
  },
];

// Active filter pill color per status
const ACTIVE_PILL_STYLES: Record<FilterOption, string> = {
  All: "bg-navy text-white shadow-sm",
  "Ready for Review": "bg-success text-white shadow-sm",
  "Intake Pending": "bg-warning text-white shadow-sm",
  "Pending Email Verification": "bg-text-muted text-white shadow-sm",
};

// ── Status badge color map ────────────────────────────────────────────────────

const STATUS_BADGE_STYLES: Record<ClientStatus, string> = {
  "Pending Email Verification": "bg-bg-alt text-text-muted",
  "Intake Pending": "bg-warning-bg text-warning",
  "Ready for Review": "bg-success-bg text-success",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardClientTable({ clients }: DashboardClientTableProps) {
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");

  // Derive counts per status (always from full list)
  const counts = useMemo(() => {
    const map: Record<FilterOption, number> = {
      All: clients.length,
      "Ready for Review": 0,
      "Intake Pending": 0,
      "Pending Email Verification": 0,
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
          <table className="w-full border-collapse text-sm min-w-[640px]" aria-label="Client roster">
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
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="text-[0.8125rem] font-semibold text-crimson no-underline whitespace-nowrap transition-[color] duration-fast hover:text-crimson-hover hover:underline"
                      aria-label={`View profile for ${client.email}`}
                    >
                      View →
                    </Link>
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
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IntakeIndicator({ client }: { client: DashboardClientRow }) {
  if (!client.isVerified) return <span className="text-[0.8125rem] font-medium text-text-muted">N/A</span>;
  if (!client.intakeProfile) return <span className="text-[0.8125rem] font-medium text-text-muted">Not started</span>;
  if (!client.intakeProfile.isCompleted) return <span className="text-[0.8125rem] font-medium text-warning">In progress</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-success">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Complete
    </span>
  );
}
