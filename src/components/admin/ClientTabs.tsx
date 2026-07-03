/**
 * src/components/admin/ClientTabs.tsx
 *
 * Tabbed container for the Client Directory page.
 *
 * Migrated from CSS Modules → Tailwind CSS (Phase 2).
 */

"use client";

import { useState, type ReactNode } from "react";
import PendingInvitesTable from "./PendingInvitesTable";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "clients" | "invites";

interface ClientTabsProps {
  children: ReactNode;
  adminToken: string;
  clientCount: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientTabs({
  children,
  adminToken,
  clientCount,
}: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("clients");

  const tabBase =
    "relative inline-flex items-center gap-2 py-3.5 px-5 font-sans text-[0.8125rem] font-semibold tracking-[0.02em] bg-transparent border-none cursor-pointer transition-[color] duration-200 ease-in-out whitespace-nowrap after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-[2px] after:h-[2px] after:rounded-t after:transition-[background] after:duration-200 after:ease-in-out";

  const tabInactive = `${tabBase} text-text-muted hover:text-navy after:bg-transparent`;
  const tabActive = `${tabBase} text-crimson after:bg-crimson`;

  return (
    <>
      {/* ── Tab bar ────────────────────────────────────────── */}
      <div
        className="flex border-b-2 border-border px-6 bg-transparent"
        role="tablist"
        aria-label="Client directory tabs"
      >
        <button
          type="button"
          role="tab"
          id="tab-clients"
          aria-selected={activeTab === "clients"}
          aria-controls="tabpanel-clients"
          className={activeTab === "clients" ? tabActive : tabInactive}
          onClick={() => setActiveTab("clients")}
        >
          <UsersIcon />
          Active Clients
          <span
            className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-[10px] text-[0.6875rem] font-bold leading-none ${
              activeTab === "clients"
                ? "bg-[rgba(179,30,60,0.1)] text-crimson"
                : "bg-bg-alt text-text-muted"
            }`}
          >
            {clientCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-invites"
          aria-selected={activeTab === "invites"}
          aria-controls="tabpanel-invites"
          className={activeTab === "invites" ? tabActive : tabInactive}
          onClick={() => setActiveTab("invites")}
        >
          <MailIcon />
          Pending Invites
        </button>
      </div>

      {/* ── Tab panels ─────────────────────────────────────── */}
      {activeTab === "clients" && (
        <div
          role="tabpanel"
          id="tabpanel-clients"
          aria-labelledby="tab-clients"
          className="animate-fade-in"
        >
          {children}
        </div>
      )}

      {activeTab === "invites" && (
        <div
          role="tabpanel"
          id="tabpanel-invites"
          aria-labelledby="tab-invites"
          className="animate-fade-in"
        >
          <PendingInvitesTable adminToken={adminToken} />
        </div>
      )}
    </>
  );
}

// ── Inline SVG Icons ────────────────────────────────────────────────────────

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}
