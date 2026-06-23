"use client";

/**
 * src/components/admin/AdminSidebar.tsx
 *
 * Dashboard sidebar navigation — client component (manages mobile open/close state).
 *
 * Desktop: permanent left sidebar (240px)
 * Mobile:  hidden by default, slides in as a drawer on hamburger tap
 *          Backdrop overlay closes it on click
 *
 * Logout: submits a hidden form via POST to /api/auth/admin-logout
 *         (POST prevents CSRF via prefetch/link)
 */

import { useState, useCallback } from "react";
import styles from "./AdminSidebar.module.css";

// ── Nav items (shell only — features added in future milestones) ──────────────
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: GridIcon, href: "/admin/dashboard", active: true },
  { id: "clients",   label: "Clients",   icon: UsersIcon, href: "/admin/clients",  active: false, soon: true },
  { id: "cases",     label: "Cases",     icon: FolderIcon, href: "/admin/cases",   active: false, soon: true },
  { id: "documents", label: "Documents", icon: FileIcon,  href: "/admin/documents", active: false, soon: true },
  { id: "settings",  label: "Settings",  icon: GearIcon,  href: "/admin/settings", active: false, soon: true },
] as const;

// ── Sidebar component ─────────────────────────────────────────────────────────

export default function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const openMenu  = useCallback(() => setMobileOpen(true),  []);
  const closeMenu = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      {/* ── Mobile hamburger trigger ─────────────────────── */}
      <button
        className={styles.hamburger}
        onClick={openMenu}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar"
      >
        <HamburgerIcon />
      </button>

      {/* ── Backdrop (mobile only) ───────────────────────── */}
      {mobileOpen && (
        <div
          className={styles.backdrop}
          onClick={closeMenu}
          aria-hidden
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside
        id="admin-sidebar"
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}
        aria-label="Administration navigation"
      >
        {/* Mobile close button */}
        <button
          className={styles.closeBtn}
          onClick={closeMenu}
          aria-label="Close navigation"
        >
          <CloseIcon />
        </button>

        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <ScalesIcon />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandThe}>THE</span>
            <span className={styles.brandName}>Independence</span>
            <span className={styles.brandName}>Law Firm</span>
          </div>
        </div>

        {/* Section label */}
        <p className={styles.sectionLabel}>Administration</p>

        {/* Nav items */}
        <nav className={styles.nav} aria-label="Admin navigation">
          <ul className={styles.navList} role="list">
            {NAV_ITEMS.map(({ id, label, icon: Icon, href, active, soon }) => (
              <li key={id}>
                {active ? (
                  <a
                    href={href}
                    className={`${styles.navItem} ${styles.navItemActive}`}
                    aria-current="page"
                    onClick={closeMenu}
                  >
                    <Icon />
                    <span>{label}</span>
                  </a>
                ) : (
                  <span
                    className={`${styles.navItem} ${styles.navItemDisabled}`}
                    aria-disabled="true"
                    title="Coming soon"
                  >
                    <Icon />
                    <span>{label}</span>
                    {soon && <span className={styles.soonBadge}>Soon</span>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Spacer */}
        <div className={styles.flex1} />

        {/* Logout form — POST to prevent CSRF via link prefetch */}
        <div className={styles.logoutArea}>
          <form action="/api/auth/admin-logout" method="POST">
            <button
              type="submit"
              className={styles.logoutBtn}
              id="admin-logout-btn"
            >
              <LogoutIcon />
              Sign Out
            </button>
          </form>
          <p className={styles.sessionNote}>Admin session · 8h</p>
        </div>
      </aside>
    </>
  );
}

// ── SVG Icons (inline — no external deps) ────────────────────────────────────

function ScalesIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="rgba(179,30,60,0.15)" />
      <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="24" y1="12" x2="24" y2="38" />
        <line x1="14" y1="16" x2="34" y2="16" />
        <line x1="14" y1="16" x2="11" y2="26" />
        <line x1="14" y1="16" x2="17" y2="26" />
        <path d="M11 26 Q14 29 17 26" fill="none" />
        <line x1="34" y1="16" x2="31" y2="26" />
        <line x1="34" y1="16" x2="37" y2="26" />
        <path d="M31 26 Q34 29 37 26" fill="none" />
        <line x1="20" y1="38" x2="28" y2="38" />
      </g>
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="3" y1="6"  x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
