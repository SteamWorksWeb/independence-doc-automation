/**
 * src/app/admin/message-center/layout.tsx
 *
 * Shell layout for /admin/message-center.
 * Uses AdminShell for the sidebar, top bar, and tool nav. The page content
 * is rendered without inner padding so the split-pane fills the available area.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ToolNavigationBar from "@/components/admin/ToolNavigationBar";
import { getAdminSession } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Message Center | Admin | Liberty",
  description: "Staff triage inbox — view and reply to borrower conversations.",
  robots: { index: false, follow: false },
};

/**
 * Full-bleed layout variant for the Message Center.
 * The split-pane needs to occupy 100% of the remaining viewport height;
 * the standard AdminShell wraps children in a padded, scrolling div which
 * breaks the CRM layout. This inline shell replicates AdminShell exactly
 * but replaces the padded content wrapper with a flex-1 overflow-hidden div.
 */
export default async function MessageCenterLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();

  return (
    <div className="flex min-h-dvh bg-[#eef0f5]">
      {/* Permanent / off-canvas sidebar — manages its own mobile state */}
      <AdminSidebar role={session?.role ?? null} />

      {/* Main content column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ────────────────────────────────────────────────── */}
        <header className="h-14 bg-white border-b border-[#dde2ea] flex items-center justify-between px-7 max-[900px]:px-4 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3.5 max-[900px]:gap-2.5">
            <span className="font-sans text-[0.8125rem] font-semibold text-[#9ca3af] tracking-[0.08em] uppercase max-[480px]:hidden">
              Administration
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-sans text-xs font-semibold text-[#16a34a] bg-[#f0fdf4] py-1 px-2.5 rounded-[20px]">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse shrink-0"
                aria-hidden
              />
              Secure Session
            </span>
          </div>
        </header>

        {/* ── Tool navigation bar ──────────────────────────────────── */}
        <ToolNavigationBar />

        {/* ── Full-bleed page content (no padding) ─────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>

      </div>
    </div>
  );
}
