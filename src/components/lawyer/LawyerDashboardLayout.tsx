/**
 * src/components/lawyer/LawyerDashboardLayout.tsx
 *
 * Master layout shell for the Lawyer Dashboard.
 * Wraps all lawyer-facing content with the sticky DashboardHeader
 * and a spacious main content grid.
 */

import React from "react";
import DashboardHeader from "./DashboardHeader";

interface LawyerDashboardLayoutProps {
  children: React.ReactNode;
}

export default function LawyerDashboardLayout({ children }: LawyerDashboardLayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f5f7]">
      {/* Sticky header */}
      <DashboardHeader />

      {/* Main content */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-5 py-6">
        {children}
      </main>
    </div>
  );
}
