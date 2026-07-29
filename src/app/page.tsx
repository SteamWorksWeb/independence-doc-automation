/**
 * src/app/page.tsx
 *
 * Authentication gateway — the sole entry point to the client portal.
 * Distraction-free, mobile-first design matching Liberty brand.
 *
 * Layout: Full-viewport split
 *   Left  (desktop): Brand panel with firm identity, trust signals, firm description
 *   Right (desktop): Centered auth card
 *   Mobile: Stacked — brand strip + auth card
 */

import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Secure Client Portal | Liberty",
  description:
    "Access your legal documents, case status, and communications through Liberty's secure client portal.",
};

export default function HomePage() {
  return (
    <main className={styles.root}>
      {/* ── Left: Brand Panel ─────────────────────────────────── */}
      <aside className={styles.brandPanel} aria-label="Firm information">
        {/* Overlay gradient on top of dark bg */}
        <div className={styles.brandOverlay} aria-hidden />

        {/* Logo & firm name */}
        <div className={styles.brandLogo}>
          <ScalesIcon />

        </div>

        {/* Hero statement */}
        <div className={styles.brandHero}>
          <h2 className={styles.brandHeadline}>
            <em>Your Case.</em>
            <br />
            Your Documents.
            <br />
            Your Relief.
          </h2>
          <p className={styles.brandBody}>
            This secure portal gives you 24/7 access to your case documents,
            case status updates, and direct communication with your legal team.
          </p>
        </div>

        {/* Trust statistics */}
        <div className={styles.brandStats} role="list" aria-label="Firm credentials">
          <div className={styles.stat} role="listitem">
            <span className={styles.statNumber}>5★</span>
            <span className={styles.statLabel}>Google Rating</span>
          </div>
          <div className={styles.statDivider} aria-hidden />
          <div className={styles.stat} role="listitem">
            <span className={styles.statNumber}>A+</span>
            <span className={styles.statLabel}>BBB Rating</span>
          </div>
          <div className={styles.statDivider} aria-hidden />
          <div className={styles.stat} role="listitem">
            <span className={styles.statNumber}>24/7</span>
            <span className={styles.statLabel}>Portal Access</span>
          </div>
        </div>

        {/* Firm values strip */}
        <div className={styles.values}>
          {["Integrity", "Compassion", "Results"].map((v) => (
            <span key={v} className={styles.valueTag}>
              <CheckmarkIcon />
              {v}
            </span>
          ))}
        </div>

        {/* Footer link */}
        <div className={styles.brandFooter}>
          <a
            href="https://theindependencelaw.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.brandLink}
          >
            ← Return to main website
          </a>
        </div>
      </aside>

      {/* ── Right: Auth Form ──────────────────────────────────── */}
      <section className={styles.authPanel} aria-label="Sign in or create account">
        {/* Mobile-only firm name strip */}
        <div className={styles.mobileHeader} aria-hidden>
          <ScalesIcon size={28} />

        </div>

        <div className={styles.authInner}>
          <AuthForm />

          <p className={styles.legalNote}>
            By accessing this portal, you agree to our{" "}
            <a href="#" className={styles.legalLink}>
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className={styles.legalLink}>
              Privacy Policy
            </a>
            . All communications are protected by attorney-client privilege.
          </p>
        </div>
      </section>
    </main>
  );
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

function ScalesIcon({ size = 48 }: { size?: number }) { return <img src="/logo.png" alt="Liberty Logo" width={size} height={size} style={{ objectFit: "contain" }} /> }

function CheckmarkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
