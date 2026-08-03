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
 * Role-based navigation:
 *   SUPER_ADMIN — full flat list including Leads, Staff, and firm Settings
 *   LAWYER      — focused list (no Leads, no Staff, no firm Settings)
 */

import React, { useState, useCallback } from "react";
import { usePathname } from "next/navigation";

// ── Nav item definition ────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: () => React.ReactElement;
  href: string;
}

// ── SUPER_ADMIN navigation (full access) ──────────────────────────────────────

const SUPER_ADMIN_NAV: NavItem[] = [
  { id: "dashboard",  label: "Dashboard", icon: GridIcon,    href: "/admin/dashboard"       },
  { id: "leads",      label: "Leads",     icon: LeadsIcon,   href: "/admin/leads"            },
  { id: "clients",    label: "Clients",   icon: UsersIcon,   href: "/admin/clients"          },
  { id: "staff",      label: "Staff",     icon: ShieldIcon,  href: "/admin/staff"            },
  { id: "cases",      label: "Cases",     icon: FolderIcon,  href: "/admin/cases"            },
  { id: "documents",  label: "Documents", icon: FileIcon,    href: "/admin/documents"        },
  { id: "messages",   label: "Messages",  icon: MessageIcon, href: "/admin/message-center"   },
  { id: "profile",    label: "Profile",   icon: PersonIcon,  href: "/admin/settings"         },
  { id: "settings",   label: "Settings",  icon: BuildingIcon,href: "/admin/firm-settings"    },
];

// ── LAWYER navigation (restricted access) ────────────────────────────────────

const LAWYER_NAV: NavItem[] = [
  { id: "dashboard",  label: "Dashboard", icon: GridIcon,    href: "/admin/dashboard"       },
  { id: "clients",    label: "Clients",   icon: UsersIcon,   href: "/admin/clients"          },
  { id: "cases",      label: "Cases",     icon: FolderIcon,  href: "/admin/cases"            },
  { id: "documents",  label: "Documents", icon: FileIcon,    href: "/admin/documents"        },
  { id: "messages",   label: "Messages",  icon: MessageIcon, href: "/admin/message-center"   },
  { id: "profile",    label: "Profile",   icon: PersonIcon,  href: "/admin/settings"         },
];

// ── Sidebar component ─────────────────────────────────────────────────────────

interface AdminSidebarProps {
  /** RBAC role from the decoded admin_session JWT. Controls nav visibility. */
  role?: string | null;
}

export default function AdminSidebar({ role }: AdminSidebarProps = {}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = role === "SUPER_ADMIN" ? SUPER_ADMIN_NAV : LAWYER_NAV;

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
        <div className="px-5 pt-6 pb-5 border-b border-[rgba(255,255,255,0.08)] block">
          <ScalesIcon />
        </div>

        {/* Section label */}
        <p className="font-sans text-[0.6rem] font-bold tracking-[0.18em] uppercase text-[rgba(255,255,255,0.3)] pt-5 px-5 pb-2">
          Administration
        </p>

        {/* Flat nav list — role-gated */}
        <nav className="px-2.5" aria-label="Admin navigation">
          <ul className="list-none flex flex-col gap-0.5" role="list">
            {navItems.map(({ id, label, icon: Icon, href }) => {
              // Exact match for dashboard; prefix match for everything else
              const isActive =
                href === "/admin/dashboard"
                  ? pathname === href
                  : pathname.startsWith(href);

              return (
                <li key={id}>
                  <a
                    href={href}
                    onClick={closeMenu}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "flex items-center gap-2.5 py-[9px] px-3 rounded-md font-sans text-[0.875rem] font-semibold no-underline cursor-pointer select-none transition-[background,color] duration-fast hover:no-underline",
                      isActive
                        ? "bg-[rgba(255,255,255,0.15)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                        : "text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white",
                    ].join(" ")}
                  >
                    <Icon />
                    <span>{label}</span>
                  </a>
                </li>
              );
            })}
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
    <img
      src="/logo.png"
      alt="Liberty Logo"
      style={{ width: "100%", height: "auto", minWidth: "140px", maxWidth: "200px", objectFit: "contain" }}
    />
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

/** Funnel icon — represents sales pipeline / leads */
function LeadsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
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

/** Shield icon — represents staff / trusted team members */
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/** Single user silhouette — personal profile / account settings */
function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/** Building icon — firm-level / global settings */
function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
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
