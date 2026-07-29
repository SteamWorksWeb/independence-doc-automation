/**
 * src/app/admin/dashboard/layout.tsx
 *
 * Shell layout for /admin/dashboard/* routes.
 * Delegates all chrome (sidebar, top bar, tool nav) to AdminShell.
 */

import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: {
    default: "Dashboard | Admin | Liberty",
    template: "%s | Admin | Liberty",
  },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
