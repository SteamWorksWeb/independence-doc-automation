/**
 * src/app/admin/clients/layout.tsx
 *
 * Shell layout for /admin/clients/* routes.
 * Delegates all chrome (sidebar, top bar, tool nav) to AdminShell.
 */

import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: {
    default: "Clients | Admin | Liberty",
    template: "%s | Admin | Liberty",
  },
  robots: { index: false, follow: false },
};

export default function ClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
