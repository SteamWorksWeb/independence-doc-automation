/**
 * src/app/admin/discharge-snapshots/layout.tsx
 *
 * Shell layout for /admin/discharge-snapshots/* routes.
 * Delegates all chrome (sidebar, top bar, tool nav) to AdminShell.
 */

import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: {
    default: "Discharge Snapshots | Admin | The Independence Law Firm",
    template: "%s | Admin | The Independence Law Firm",
  },
  robots: { index: false, follow: false },
};

export default function DischargeSnapshotsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
