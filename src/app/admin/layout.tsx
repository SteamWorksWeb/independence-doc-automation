/**
 * src/app/admin/layout.tsx
 *
 * Thin parent layout for all /admin/* routes.
 *
 * Why this is minimal:
 *   Next.js layouts nest. /admin/login has its own layout (the vault door)
 *   which renders inside this one. /admin/dashboard has its own layout
 *   (the dashboard shell) which also renders inside this one.
 *
 *   This parent purely establishes the HTML base + global styles so that
 *   neither child layout has to import globals.css independently.
 *
 *   No visual chrome here — every admin sub-route brings its own UI frame.
 */

import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
