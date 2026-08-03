/**
 * src/app/dashboard/layout.tsx
 *
 * Client Dashboard Shell — wraps all /dashboard/* routes.
 *
 * Redesigned to mirror the Admin dashboard architecture:
 *   - Dark navy sidebar (ClientSidebar, 240px)
 *   - White top bar with Secure Session badge + client email
 *   - Content area with consistent padding
 *
 * Previously used a flat top-nav + tab-bar pattern. Now delegates
 * all chrome to ClientShell (mirrors AdminShell on the admin side).
 */

import type { Metadata } from "next";
import ClientShell from "@/components/client/ClientShell";

export const metadata: Metadata = {
  title: {
    default: "My Dashboard | Liberty",
    template: "%s | Liberty",
  },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientShell>{children}</ClientShell>;
}
