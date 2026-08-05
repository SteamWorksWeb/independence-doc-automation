/**
 * src/app/admin/login/layout.tsx
 *
 * Minimal pass-through layout for the admin login route.
 *
 * The visual layout (sidebar, background, centering) is now handled
 * entirely by AuthLayout + AuthSidebar in admin/login/page.tsx.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administration | Liberty",
  description: "Restricted access. Authorized personnel only.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
