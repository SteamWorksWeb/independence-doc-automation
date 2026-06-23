/**
 * src/app/admin/dashboard/layout.tsx
 *
 * Dashboard shell layout — wraps all authenticated admin pages under /admin/dashboard/*.
 *
 * Structure:
 *   ┌─────────────────────────────────────────┐
 *   │ [Sidebar 240px] │ [Top bar + Main area]  │
 *   │                 │                         │
 *   │  Brand          │  ≡ Hamburger (mobile)  │
 *   │  Nav items      │  Page header           │
 *   │  ...            │  <children />          │
 *   │  [Logout]       │                         │
 *   └─────────────────────────────────────────┘
 *
 * Mobile: Sidebar collapses to off-canvas drawer.
 *         Top bar shows hamburger + firm name.
 */

import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: {
    default: "Dashboard | Admin | The Independence Law Firm",
    template: "%s | Admin | The Independence Law Firm",
  },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
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
          {/* Hamburger is rendered inside AdminSidebar but positioned here via CSS */}
          <div className={styles.topBarLeft}>
            {/* This slot is filled by the hamburger button from AdminSidebar on mobile */}
            <span className={styles.topBarTitle}>Administration</span>
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
