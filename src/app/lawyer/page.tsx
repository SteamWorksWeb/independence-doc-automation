/**
 * src/app/lawyer/page.tsx
 *
 * Lawyer Dashboard — Primary attorney-facing page.
 *
 * Renders the full LawyerDashboardLayout (header + nav) and
 * the BorrowerGrid content area.
 */

import type { Metadata } from "next";
import LawyerDashboardLayout from "@/components/lawyer/LawyerDashboardLayout";
import BorrowerGrid from "@/components/lawyer/BorrowerGrid";

export const metadata: Metadata = {
  title: "Lawyer Dashboard",
};

export default function LawyerDashboardPage() {
  return (
    <LawyerDashboardLayout>
      {/* ── Borrower Accounts Data Grid ─────────────────────── */}
      <BorrowerGrid defaultTab="bk-discharges" />
    </LawyerDashboardLayout>
  );
}
