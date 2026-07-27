/**
 * src/components/admin/AdminShell.tsx
 *
 * Shared authenticated admin shell — used by every admin sub-route layout
 * (dashboard, clients, cases, documents, and all future pages).
 *
 * Structure:
 *   ┌──────────────────────────────────────────────────┐
 *   │  AdminSidebar (240px, sticky)                    │
 *   │─────────────────────────────────────────────────│
 *   │  Top bar  (ADMINISTRATION label + Secure Session) │
 *   │  ToolNavigationBar (Home → Calculator + Search)  │
 *   │  {children}                                       │
 *   └──────────────────────────────────────────────────┘
 *
 * To add the shell to any new page: just import AdminShell and wrap children.
 */

import AdminSidebar from "@/components/admin/AdminSidebar";
import ToolNavigationBar from "@/components/admin/ToolNavigationBar";
import type { ReactNode } from "react";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-[#eef0f5]">
      {/* Permanent / off-canvas sidebar — manages its own mobile state */}
      <AdminSidebar />

      {/* Main content column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ───────────────────────────────────────────────────── */}
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

        {/* ── Tool navigation bar ───────────────────────────────────────── */}
        <ToolNavigationBar />

        {/* ── Page content ──────────────────────────────────────────────── */}
        <div className="flex-1 py-8 px-7 max-[900px]:py-5 max-[900px]:px-4 overflow-y-auto">
          {children}
        </div>

      </div>
    </div>
  );
}
