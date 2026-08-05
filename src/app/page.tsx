/**
 * src/app/page.tsx
 *
 * Root landing page — apply.theindependencelaw.com
 *
 * Intentionally minimal: logo + two login buttons.
 * No marketing copy, no trust signals, no distractions.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Liberty Law",
  description: "Secure access portal for Liberty Law clients and staff.",
  robots: { index: false, follow: false },
};

export default function RootPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #1A2744 0%, #0f1a33 100%)",
        padding: "2rem 1rem",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: "3rem" }}>
        <Image
          src="/logo.png"
          alt="Liberty Law"
          width={200}
          height={80}
          style={{ objectFit: "contain", display: "block" }}
          priority
        />
      </div>

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "100%",
          maxWidth: "280px",
        }}
      >
        {/* Client Login */}
        <Link
          href="/login"
          style={{
            display: "block",
            textAlign: "center",
            padding: "14px 24px",
            backgroundColor: "#B31E3C",
            color: "#FFFFFF",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "14px",
            fontWeight: "700",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            textDecoration: "none",
            borderRadius: "4px",
            border: "2px solid #B31E3C",
            transition: "background-color 150ms, border-color 150ms",
          }}
        >
          Client Login
        </Link>

        {/* Admin Login */}
        <Link
          href="/admin/login"
          style={{
            display: "block",
            textAlign: "center",
            padding: "14px 24px",
            backgroundColor: "transparent",
            color: "rgba(255,255,255,0.75)",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "14px",
            fontWeight: "600",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            textDecoration: "none",
            borderRadius: "4px",
            border: "2px solid rgba(255,255,255,0.25)",
          }}
        >
          Administration
        </Link>
      </div>
    </main>
  );
}
