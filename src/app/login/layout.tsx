/**
 * src/app/login/layout.tsx
 *
 * Minimal pass-through layout for the client login route.
 *
 * The visual layout (sidebar, background, centering) is now handled
 * entirely by AuthLayout + AuthSidebar in login/page.tsx — this layout
 * exists only to set the route metadata and import globals.css.
 */

import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Client Sign In — Liberty",
  description:
    "Securely sign in to the Liberty Client Portal to access your case documents.",
  robots: {
    index: true,
    follow: false,
  },
};

export default function ClientLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
