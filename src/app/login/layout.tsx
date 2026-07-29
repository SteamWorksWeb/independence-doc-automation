/**
 * src/app/login/layout.tsx
 *
 * Isolated layout for the client login route.
 * Completely separate from the admin login — no shared session context.
 *
 * Renders:
 *   - Brand mark fixed top-left (logo + firm name)
 *   - Full-viewport textured background (matches admin vault aesthetic)
 *   - Children (the login form) centered via CSS grid
 *   - Footer stamp: "Client Portal"
 */

import type { Metadata } from "next";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Client Sign In — Liberty",
  description:
    "Securely sign in to the Liberty Client Portal to access your case documents.",
  robots: {
    // Indexable — clients need to be able to find this page
    index: true,
    follow: false,
  },
};

export default function ClientLoginLayout({
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

      {/* ── Discreet footer stamp ─────────────────────────── */}
      <footer className={styles.footer} aria-hidden>
        Client Portal
      </footer>
    </div>
  );
}

function ScalesIcon() { return <img src="/logo.png" alt="Liberty Logo" width={32} height={32} style={{ objectFit: "contain" }} /> }
