/**
 * src/app/dashboard/layout.tsx
 *
 * Client Dashboard Shell — wraps all /dashboard/* routes.
 *
 * Migrated from CSS Modules → Tailwind CSS (Phase 2).
 */

import type { Metadata } from "next";

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
    <div className="min-h-dvh flex flex-col bg-bg">
      {/* ── Top header ─────────────────────────────────────── */}
      <header className="bg-navy border-b-[3px] border-crimson px-6 max-[640px]:px-4 sticky top-0 z-[100]">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between h-16 max-[640px]:h-14 gap-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <ScalesIcon />
            </div>
            <div className="flex flex-col leading-[1.15]">
              <span className="font-sans text-[0.5625rem] font-bold tracking-[0.25em] uppercase text-white/50">
                THE
              </span>
              <span className="font-serif text-[0.9375rem] max-[640px]:text-[0.8125rem] font-bold text-white">
                Independence Law Firm
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-white/70 py-1 px-3 rounded-[20px] bg-white/[0.08] border border-white/[0.12] max-[640px]:hidden">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse shrink-0"
                aria-hidden
              />
              Secure Session
            </span>
            <form action="/api/auth/client-logout" method="POST">
              <button
                type="submit"
                className="font-sans text-[0.8125rem] font-semibold text-white/60 bg-transparent border border-white/[0.15] rounded-md py-1.5 px-3.5 cursor-pointer transition-all duration-150 ease-in-out hover:text-white hover:border-white/40 hover:bg-white/[0.08]"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────── */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto py-8 px-6 max-[640px]:py-5 max-[640px]:px-4">
        {children}
      </main>
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
