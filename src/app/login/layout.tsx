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
  title: "Client Sign In — The Independence Law Firm",
  description:
    "Securely sign in to the Independence Law Client Portal to access your case documents.",
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
          <span className={styles.brandThe}>THE</span>
          <span className={styles.brandName}>Independence Law Firm</span>
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

function ScalesIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="24" cy="24" r="24" fill="rgba(179,30,60,0.12)" />
      <g
        stroke="#1a2744"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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
