"use client";

/**
 * src/app/dashboard/DashboardNav.tsx
 *
 * Sticky tab navigation for the client dashboard shell.
 * Uses usePathname to highlight the active tab.
 *
 * Tabs:
 *   Home      → /dashboard
 *   Documents → /dashboard/documents
 *   Messages  → /dashboard/messages
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavTab {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Match only the exact path (for Home) */
  exact?: boolean;
}

const TABS: NavTab[] = [
  {
    href: "/dashboard",
    label: "Home",
    exact: true,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/dashboard/documents",
    label: "Documents",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    href: "/dashboard/messages",
    label: "Messages",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export default function DashboardNav() {
  const pathname = usePathname();

  function isActive(tab: NavTab): boolean {
    if (tab.exact) return pathname === tab.href;
    return pathname.startsWith(tab.href);
  }

  return (
    <nav aria-label="Dashboard navigation">
      <ul className="flex items-center gap-1 m-0 p-0 list-none">
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                id={`dashboard-nav-${tab.label.toLowerCase()}`}
                className={[
                  "inline-flex items-center gap-2 px-4 py-3.5 text-[0.8125rem] font-semibold",
                  "border-b-2 transition-all duration-150 whitespace-nowrap",
                  active
                    ? "border-crimson text-navy"
                    : "border-transparent text-text-muted hover:text-navy hover:border-border",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {tab.icon}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
