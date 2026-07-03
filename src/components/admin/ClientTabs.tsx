/**
 * src/components/admin/ClientTabs.tsx
 *
 * Tabbed container for the Client Directory page.
 *
 * Two tabs:
 *   1. "Active Clients"  — renders the server-fetched client roster (passed as children)
 *   2. "Pending Invites" — mounts the PendingInvitesTable client component
 *
 * This is a "use client" component because tab switching is interactive state.
 * The client roster content is passed via React children so it can be server-rendered.
 */

"use client";

import { useState, type ReactNode } from "react";
import PendingInvitesTable from "./PendingInvitesTable";
import styles from "./ClientTabs.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "clients" | "invites";

interface ClientTabsProps {
  /** Server-rendered client roster table content */
  children: ReactNode;
  /** Admin JWT for the invites API calls */
  adminToken: string;
  /** Count of active clients (for the tab badge) */
  clientCount: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientTabs({
  children,
  adminToken,
  clientCount,
}: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("clients");

  return (
    <>
      {/* ── Tab bar ────────────────────────────────────────── */}
      <div className={styles.tabBar} role="tablist" aria-label="Client directory tabs">
        <button
          type="button"
          role="tab"
          id="tab-clients"
          aria-selected={activeTab === "clients"}
          aria-controls="tabpanel-clients"
          className={activeTab === "clients" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("clients")}
        >
          <UsersIcon />
          Active Clients
          <span className={styles.tabCount}>{clientCount}</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-invites"
          aria-selected={activeTab === "invites"}
          aria-controls="tabpanel-invites"
          className={activeTab === "invites" ? styles.tabActive : styles.tab}
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
          className={styles.tabContent}
        >
          {children}
        </div>
      )}

      {activeTab === "invites" && (
        <div
          role="tabpanel"
          id="tabpanel-invites"
          aria-labelledby="tab-invites"
          className={styles.tabContent}
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
