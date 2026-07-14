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
 *
 * Migrated from CSS Modules → Tailwind CSS (Phase 1).
 */

import React, { useState, useCallback } from "react";

// ── Nav items (shell only — features added in future milestones) ──────────────

interface NavItem {
  id: string;
  label: string;
  icon: () => React.ReactElement;
  href: string;
  active: boolean;
  soon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: GridIcon, href: "/admin/dashboard", active: true },
  { id: "clients",   label: "Clients",   icon: UsersIcon, href: "/admin/clients",  active: true },
  { id: "cases",     label: "Cases",     icon: FolderIcon, href: "/admin/cases",   active: true },
  { id: "documents", label: "Documents", icon: FileIcon,  href: "/admin/documents", active: false, soon: true },
  { id: "settings",  label: "Settings",  icon: GearIcon,  href: "/admin/settings", active: false, soon: true },
];

// ── Sidebar component ─────────────────────────────────────────────────────────

export default function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const openMenu  = useCallback(() => setMobileOpen(true),  []);
  const closeMenu = useCallback(() => setMobileOpen(false), []);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/admin-logout", { method: "POST" });
    } catch {
      // Ignore network errors — still clear the client and redirect
    }
    // Hard redirect: bypasses Next.js router so middleware cannot intercept
    // and loop back to the dashboard before the cleared cookie propagates.
    window.location.href = "/admin/login";
  }, [isLoggingOut]);

  return (
    <>
      {/* ── Mobile hamburger trigger ─────────────────────── */}
      <button
        className="hidden max-[900px]:flex items-center justify-center bg-transparent border-none text-navy cursor-pointer p-2 rounded-md transition-[background] duration-fast hover:bg-[rgba(26,39,68,0.07)]"
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
          className="hidden max-[900px]:block fixed inset-0 bg-[rgba(0,0,0,0.45)] z-[19] backdrop-blur-[2px]"
          onClick={closeMenu}
          aria-hidden
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside
        id="admin-sidebar"
        className={`
          w-[240px] min-h-dvh bg-navy flex flex-col shrink-0 relative z-20
          shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)]
          max-[900px]:fixed max-[900px]:top-0 max-[900px]:left-0 max-[900px]:bottom-0
          max-[900px]:w-[270px] max-[900px]:min-h-dvh max-[900px]:z-30
          max-[900px]:transition-transform max-[900px]:duration-[280ms] max-[900px]:ease-[cubic-bezier(0.4,0,0.2,1)]
          ${mobileOpen
            ? "max-[900px]:translate-x-0 max-[900px]:shadow-[4px_0_32px_rgba(0,0,0,0.3)]"
            : "max-[900px]:-translate-x-full"
          }
        `}
        aria-label="Administration navigation"
      >
        {/* Mobile close button */}
        <button
          className="hidden max-[900px]:flex absolute top-3.5 right-3.5 bg-[rgba(255,255,255,0.08)] border-none rounded-md text-[rgba(255,255,255,0.7)] cursor-pointer p-1.5 leading-none transition-[background] duration-fast hover:bg-[rgba(255,255,255,0.15)]"
          onClick={closeMenu}
          aria-label="Close navigation"
        >
          <CloseIcon />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5 border-b border-[rgba(255,255,255,0.08)]">
          <div>
            <ScalesIcon />
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-[0.55rem] font-bold tracking-[0.28em] text-crimson uppercase leading-none">
              THE
            </span>
            <span className="font-serif text-[0.8rem] font-bold text-[rgba(255,255,255,0.9)] leading-[1.25]">
              Independence
            </span>
            <span className="font-serif text-[0.8rem] font-bold text-[rgba(255,255,255,0.9)] leading-[1.25]">
              Law Firm
            </span>
          </div>
        </div>

        {/* Section label */}
        <p className="font-sans text-[0.6rem] font-bold tracking-[0.18em] uppercase text-[rgba(255,255,255,0.3)] pt-5 px-5 pb-2">
          Administration
        </p>

        {/* Nav items */}
        <nav className="px-2.5" aria-label="Admin navigation">
          <ul className="list-none flex flex-col gap-0.5" role="list">
            {NAV_ITEMS.map(({ id, label, icon: Icon, href, active, soon }) => (
              <li key={id}>
                {active ? (
                  <a
                    href={href}
                    className="flex items-center gap-2.5 py-[9px] px-3 rounded-md font-sans text-[0.875rem] font-semibold text-white no-underline cursor-pointer select-none bg-[rgba(255,255,255,0.1)] transition-[background,color] duration-fast hover:bg-[rgba(255,255,255,0.14)] hover:no-underline"
                    aria-current="page"
                    onClick={closeMenu}
                  >
                    <Icon />
                    <span>{label}</span>
                  </a>
                ) : (
                  <span
                    className="flex items-center gap-2.5 py-[9px] px-3 rounded-md font-sans text-[0.875rem] font-medium text-[rgba(255,255,255,0.65)] cursor-default select-none opacity-45"
                    aria-disabled="true"
                    title="Coming soon"
                  >
                    <Icon />
                    <span>{label}</span>
                    {soon && (
                      <span className="ml-auto text-[0.6rem] font-bold tracking-[0.08em] uppercase bg-[rgba(179,30,60,0.25)] text-[rgba(255,180,190,0.9)] py-0.5 px-[7px] rounded-[20px]">
                        Soon
                      </span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Logout — fetch POST so we control the redirect explicitly */}
        <div className="px-4 pt-4 pb-5 border-t border-[rgba(255,255,255,0.08)] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2 py-[9px] px-3 bg-[rgba(179,30,60,0.12)] border border-[rgba(179,30,60,0.2)] rounded-md font-sans text-[0.8125rem] font-semibold text-[rgba(255,150,160,0.9)] cursor-pointer transition-[background,border-color] duration-fast tracking-[0.02em] hover:bg-[rgba(179,30,60,0.22)] hover:border-[rgba(179,30,60,0.35)] disabled:opacity-50 disabled:cursor-wait"
            id="admin-logout-btn"
          >
            <LogoutIcon />
            {isLoggingOut ? "Signing out…" : "Sign Out"}
          </button>
          <p className="text-[0.65rem] text-[rgba(255,255,255,0.22)] text-center tracking-[0.04em]">
            Admin session · 8h
          </p>
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
