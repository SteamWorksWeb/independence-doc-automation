/**
 * src/app/admin/dashboard/page.tsx
 *
 * Dashboard Overview — the authenticated lawyer's home base.
 *
 * v1.2 shell: overview header + stat card placeholders.
 * Data fetching and client management features come in future milestones.
 *
 * The x-admin-email header (set by middleware from the verified JWT)
 * is readable here in a server component via headers().
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Dashboard Overview",
};

export default async function DashboardPage() {
  // Read the admin email forwarded by middleware — server-side only
  const headersList = await headers();
  const adminEmail = headersList.get("x-admin-email") ?? "Administrator";

  return (
    <div className={`${styles.page} animate-fade-in`}>
      {/* ── Page header ─────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard Overview</h1>
          <p className={styles.pageSubtitle}>
            Signed in as <strong>{adminEmail}</strong>
          </p>
        </div>
        <div className={styles.dateBadge}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        {STAT_CARDS.map((card) => (
          <div key={card.id} className={styles.statCard}>
            <div className={styles.statCardIcon} style={{ background: card.iconBg }}>
              <card.Icon color={card.iconColor} />
            </div>
            <div className={styles.statCardBody}>
              <p className={styles.statCardLabel}>{card.label}</p>
              <p className={styles.statCardValue}>{card.value}</p>
              <p className={styles.statCardNote}>{card.note}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content card ────────────────────────────────── */}
      <div className={styles.contentCard}>
        <div className={styles.contentCardHeader}>
          <h2 className={styles.contentCardTitle}>Recent Activity</h2>
          <span className={styles.comingSoon}>Coming soon</span>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <InboxIcon />
          </div>
          <p className={styles.emptyTitle}>No activity yet</p>
          <p className={styles.emptyBody}>
            Client accounts, case updates, and document activity will appear
            here once the client management features are activated.
          </p>
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────── */}
      <div className={styles.quickActions}>
        <h2 className={styles.quickActionsTitle}>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              className={styles.actionCard}
              disabled
              title="Coming soon"
            >
              <div className={styles.actionIcon}>
                <action.Icon />
              </div>
              <span className={styles.actionLabel}>{action.label}</span>
              <span className={styles.actionSoon}>Soon</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Data (shell placeholders) ─────────────────────────────────────────────────

const STAT_CARDS = [
  {
    id: "clients",
    label: "Active Clients",
    value: "—",
    note: "Awaiting data integration",
    iconBg: "rgba(26,39,68,0.06)",
    iconColor: "#1a2744",
    Icon: ({ color }: { color: string }) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "cases",
    label: "Open Cases",
    value: "—",
    note: "Awaiting data integration",
    iconBg: "rgba(179,30,60,0.06)",
    iconColor: "#b31e3c",
    Icon: ({ color }: { color: string }) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "docs",
    label: "Documents",
    value: "—",
    note: "Awaiting data integration",
    iconBg: "rgba(15,123,85,0.06)",
    iconColor: "#0f7b55",
    Icon: ({ color }: { color: string }) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    id: "pending",
    label: "Pending Verifications",
    value: "—",
    note: "Awaiting data integration",
    iconBg: "rgba(217,119,6,0.06)",
    iconColor: "#d97706",
    Icon: ({ color }: { color: string }) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

const QUICK_ACTIONS = [
  { id: "new-client",  label: "Add Client",      Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> },
  { id: "new-doc",    label: "Upload Document",  Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
  { id: "message",    label: "Send Message",     Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
  { id: "report",     label: "Generate Report",  Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
];

function InboxIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
