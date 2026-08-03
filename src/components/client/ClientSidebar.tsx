"use client";

/**
 * src/components/client/ClientSidebar.tsx
 *
 * Client Portal sidebar navigation — mirrors AdminSidebar visual style exactly.
 *
 * Desktop: permanent left sidebar (240px, bg-navy)
 * Mobile:  hidden by default, slides in as a drawer on hamburger tap
 *
 * Nav items: Dashboard, My Case, Documents, Messages, Profile
 * Logout: POST to /api/auth/client-logout
 */

import React, { useState, useCallback } from "react";
import { usePathname } from "next/navigation";

// ── Nav items ─────────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: () => React.ReactElement;
  href: string;
  /** Match only the exact path (for Dashboard home) */
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard",  icon: GridIcon,    href: "/dashboard",            exact: true },
  { id: "case",      label: "My Case",    icon: FolderIcon,  href: "/dashboard",            exact: true },
  { id: "documents", label: "Documents",  icon: FileIcon,    href: "/dashboard/documents"              },
  { id: "messages",  label: "Messages",   icon: MessageIcon, href: "/dashboard/messages"               },
  { id: "profile",   label: "Profile",    icon: UserIcon,    href: "/dashboard/profile"                },
];

// ── Sidebar component ─────────────────────────────────────────────────────────

export default function ClientSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const openMenu  = useCallback(() => setMobileOpen(true),  []);
  const closeMenu = useCallback(() => setMobileOpen(false), []);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/client-logout", { method: "POST" });
    } catch {
      // Ignore network errors — still redirect
    }
    window.location.href = "/login";
  }, [isLoggingOut]);

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <>
      {/* ── Mobile hamburger trigger ───────────────────────── */}
      <button
        className="hidden max-[900px]:flex items-center justify-center bg-transparent border-none text-navy cursor-pointer p-2 rounded-md transition-[background] duration-fast hover:bg-[rgba(26,39,68,0.07)]"
        onClick={openMenu}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        aria-controls="client-sidebar"
      >
        <HamburgerIcon />
      </button>

      {/* ── Backdrop (mobile only) ─────────────────────────── */}
      {mobileOpen && (
        <div
          className="hidden max-[900px]:block fixed inset-0 bg-[rgba(0,0,0,0.45)] z-[19] backdrop-blur-[2px]"
          onClick={closeMenu}
          aria-hidden
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        id="client-sidebar"
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
        aria-label="Client portal navigation"
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
          Client Portal
        </p>

        {/* Nav items */}
        <nav className="px-2.5" aria-label="Client portal navigation">
          <ul className="list-none flex flex-col gap-0.5" role="list">
            {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => {
              const active = isActive({ id, label, icon: Icon, href, exact: NAV_ITEMS.find(n => n.id === id)?.exact });
              return (
                <li key={id}>
                  <a
                    href={href}
                    className={[
                      "flex items-center gap-2.5 py-[9px] px-3 rounded-md font-sans text-[0.875rem] font-semibold no-underline cursor-pointer select-none transition-[background,color] duration-fast hover:no-underline",
                      active
                        ? "bg-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.14)]"
                        : "text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white",
                    ].join(" ")}
                    aria-current={active ? "page" : undefined}
                    onClick={closeMenu}
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

        {/* Logout */}
        <div className="px-4 pt-4 pb-5 border-t border-[rgba(255,255,255,0.08)] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2 py-[9px] px-3 bg-[rgba(179,30,60,0.12)] border border-[rgba(179,30,60,0.2)] rounded-md font-sans text-[0.8125rem] font-semibold text-[rgba(255,150,160,0.9)] cursor-pointer transition-[background,border-color] duration-fast tracking-[0.02em] hover:bg-[rgba(179,30,60,0.22)] hover:border-[rgba(179,30,60,0.35)] disabled:opacity-50 disabled:cursor-wait"
            id="client-logout-btn"
          >
            <LogoutIcon />
            {isLoggingOut ? "Signing out…" : "Sign Out"}
          </button>
          <p className="text-[0.65rem] text-[rgba(255,255,255,0.22)] text-center tracking-[0.04em]">
            Secure client session
          </p>
        </div>
      </aside>
    </>
  );
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

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

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
