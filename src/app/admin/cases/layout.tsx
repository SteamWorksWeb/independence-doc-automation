/**
 * src/app/admin/cases/layout.tsx
 *
 * Shell layout for /admin/cases/* routes.
 *
 * Mirrors the dashboard shell (src/app/admin/dashboard/layout.tsx) so that
 * the Cases page renders inside the same sidebar + topbar chrome.
 *
 * Migrated from CSS Modules → Tailwind CSS (Phase 1).
 */

import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const metadata: Metadata = {
  title: {
    default: "Cases | Admin | The Independence Law Firm",
    template: "%s | Admin | The Independence Law Firm",
  },
  robots: { index: false, follow: false },
};

export default function CasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-[#eef0f5]">
      {/* Sidebar — handles its own mobile drawer logic */}
      <AdminSidebar />

      {/* Main content column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-border flex items-center justify-between px-7 max-[900px]:px-4 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3.5 max-[900px]:gap-2.5">
            <span className="font-sans text-[0.8125rem] font-semibold text-text-muted tracking-[0.08em] uppercase max-[480px]:hidden">
              Administration
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-sans text-xs font-semibold text-success bg-success-bg py-1 px-2.5 rounded-[20px]">
              <span
                className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0"
                aria-hidden
              />
              Secure Session
            </span>
          </div>
        </header>

        {/* Page content area */}
        <div className="flex-1 py-8 px-7 max-[900px]:py-5 max-[900px]:px-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
