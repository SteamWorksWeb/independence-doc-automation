/**
 * src/app/admin/student-loan-calculator/layout.tsx
 *
 * Shell layout for /admin/student-loan-calculator.
 * Delegates all chrome (sidebar, top bar, tool nav) to AdminShell.
 */

import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Student Loan & Settlement Analyzer | Admin | The Independence Law Firm",
  description:
    "Calculate income-driven repayment plans and private settlement targets for distressed student loan borrowers.",
  robots: { index: false, follow: false },
};

export default function StudentLoanCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
