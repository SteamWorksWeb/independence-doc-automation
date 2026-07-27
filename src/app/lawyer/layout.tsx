/**
 * src/app/lawyer/layout.tsx
 *
 * Route layout for /lawyer/* — Lawyer Dashboard shell.
 * Applies no extra chrome; LawyerDashboardLayout handles the header.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Lawyer Dashboard | The Independence Law Firm",
    template: "%s | The Independence Law Firm",
  },
  description: "Attorney-facing dashboard for managing borrower accounts, discharge analyses, and repayment plans.",
  robots: { index: false, follow: false },
};

export default function LawyerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
