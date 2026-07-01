/**
 * src/app/admin/clients/layout.tsx
 *
 * Shell layout for /admin/clients/* routes.
 *
 * Mirrors the dashboard shell (src/app/admin/dashboard/layout.tsx) so that
 * the Client 360° Profile at /admin/clients/[id] renders inside the same
 * sidebar + topbar chrome as the main dashboard.
 *
 * We reuse the dashboard layout's CSS module directly — the two shells are
 * visually identical; there's no reason to duplicate the styles.
 */

import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "@/app/admin/dashboard/layout.module.css";

export const metadata: Metadata = {
  title: {
    default: "Clients | Admin | The Independence Law Firm",
    template: "%s | Admin | The Independence Law Firm",
  },
  robots: { index: false, follow: false },
};

export default function ClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      {/* Sidebar — handles its own mobile drawer logic */}
      <AdminSidebar />

      {/* Main content column */}
      <div className={styles.main}>
        {/* Top bar */}
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.topBarTitle}>Client Profile</span>
          </div>
          <div className={styles.topBarRight}>
            <span className={styles.topBarBadge}>
              <span className={styles.dot} aria-hidden />
              Secure Session
            </span>
          </div>
        </header>

        {/* Page content area */}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
