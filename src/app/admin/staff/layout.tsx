/**
 * src/app/admin/staff/layout.tsx
 *
 * Shell layout for /admin/staff routes.
 * Delegates all chrome (sidebar, top bar, tool nav) to AdminShell.
 * Access is gated at both middleware and page level to SUPER_ADMIN only.
 */

import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: {
    default: "Staff & Invites | Admin | Independence Law",
    template: "%s | Admin | Independence Law",
  },
  robots: { index: false, follow: false },
};

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
