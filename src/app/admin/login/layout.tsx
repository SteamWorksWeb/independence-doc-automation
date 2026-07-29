/**
 * src/app/admin/login/layout.tsx
 *
 * Isolated layout for the admin login route.
 * Completely separate from the client portal layout — no shared nav,
 * no shared session context, no marketing copy.
 *
 * Renders:
 *   - Brand mark fixed top-left (logo + firm name only)
 *   - Full-viewport textured background
 *   - Children (the admin form) are centered via CSS grid
 */

import type { Metadata } from "next";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Administration | Liberty",
  description: "Restricted access. Authorized personnel only.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.root}>
      {/* ── Brand mark: top-left only ─────────────────────── */}
      <header className={styles.brand} aria-label="Firm identity">
        <ScalesIcon />
        <div className={styles.brandText}>
          <span className={styles.brandName}>Liberty</span>
        </div>
      </header>

      {/* ── Centered content slot ─────────────────────────── */}
      <main className={styles.center}>{children}</main>

      {/* ── Discreet version stamp ────────────────────────── */}
      <footer className={styles.footer} aria-hidden>
        Admin Console
      </footer>
    </div>
  );
}

function ScalesIcon() { return <img src="/logo.png" alt="Liberty Logo" width={32} height={32} style={{ objectFit: "contain" }} /> }
