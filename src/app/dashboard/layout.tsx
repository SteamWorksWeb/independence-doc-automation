/**
 * src/app/dashboard/layout.tsx
 *
 * Client Dashboard Shell — wraps all /dashboard/* routes.
 *
 * Structure:
 *   ┌──────────────────────────────────────────────────┐
 *   │ [Header: Brand + Secure badge + Sign Out]        │
 *   ├──────────────────────────────────────────────────┤
 *   │                                                  │
 *   │            <children /> (page content)            │
 *   │                                                  │
 *   └──────────────────────────────────────────────────┘
 *
 * The header is simpler than the admin sidebar — clients see a clean,
 * confidence-inspiring bar with the firm brand and a sign-out option.
 */

import type { Metadata } from "next";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: {
    default: "My Dashboard | The Independence Law Firm",
    template: "%s | The Independence Law Firm",
  },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      {/* ── Top header ─────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <ScalesIcon />
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandThe}>THE</span>
              <span className={styles.brandName}>Independence Law Firm</span>
            </div>
          </div>

          <div className={styles.headerRight}>
            <span className={styles.secureBadge}>
              <span className={styles.secureDot} aria-hidden />
              Secure Session
            </span>
            <form action="/api/auth/client-logout" method="POST">
              <button type="submit" className={styles.signOutBtn}>
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────── */}
      <main className={styles.content}>{children}</main>
    </div>
  );
}

// ── Inline SVG ────────────────────────────────────────────────────────────────

function ScalesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="rgba(179,30,60,0.15)" />
      <g stroke="#b31e3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="24" y1="12" x2="24" y2="38" />
        <line x1="14" y1="16" x2="34" y2="16" />
        <line x1="14" y1="16" x2="11" y2="26" />
        <line x1="14" y1="16" x2="17" y2="26" />
        <path d="M11 26 Q14 29 17 26" fill="none" />
        <line x1="34" y1="16" x2="31" y2="26" />
        <line x1="34" y1="16" x2="37" y2="26" />
        <path d="M31 26 Q34 29 37 26" fill="none" />
        <line x1="20" y1="38" x2="28" y2="38" />
      </g>
    </svg>
  );
}
