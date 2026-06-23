/**
 * src/app/page.tsx
 *
 * Authentication gateway — the sole entry point to the client portal.
 * Distraction-free, mobile-first design matching The Independence Law Firm brand.
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
  title: "Secure Client Portal | The Independence Law Firm",
  description:
    "Access your legal documents, case status, and communications through The Independence Law Firm's secure client portal.",
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
          <div>
            <p className={styles.brandTagline}>THE</p>
            <p className={styles.brandFirmName}>Independence</p>
            <p className={styles.brandFirmName}>Law Firm</p>
          </div>
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
          <span className={styles.mobileFirmName}>The Independence Law Firm</span>
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

function ScalesIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="24" cy="24" r="24" fill="rgba(179,30,60,0.15)" />
      <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Scales of justice */}
        <line x1="24" y1="12" x2="24" y2="38" />
        <line x1="14" y1="16" x2="34" y2="16" />
        {/* Left scale */}
        <line x1="14" y1="16" x2="11" y2="26" />
        <line x1="14" y1="16" x2="17" y2="26" />
        <path d="M11 26 Q14 29 17 26" fill="none" />
        {/* Right scale */}
        <line x1="34" y1="16" x2="31" y2="26" />
        <line x1="34" y1="16" x2="37" y2="26" />
        <path d="M31 26 Q34 29 37 26" fill="none" />
        {/* Base */}
        <line x1="20" y1="38" x2="28" y2="38" />
      </g>
    </svg>
  );
}

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
