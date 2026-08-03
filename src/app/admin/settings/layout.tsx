/**
 * src/app/admin/settings/layout.tsx
 *
 * Shell layout for /admin/settings/* routes.
 * Uses AdminShell for the sidebar + top bar chrome, matching
 * every other authenticated admin sub-route.
 */

import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Settings | Admin | Liberty",
  description: "Manage your admin profile and account settings.",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
