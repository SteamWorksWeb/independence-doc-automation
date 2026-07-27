"use client";

import Link from "next/link";
import InviteBorrowerModal from "@/components/admin/InviteBorrowerModal";

/**
 * src/components/admin/ToolNavigationBar.tsx
 *
 * Horizontal tool navigation bar for the authenticated admin/lawyer dashboard.
 *
 * Contains:
 *   - Icon-based nav: Home, Discharge SnapShot, BK Analyzer, Repayment Analyzer,
 *     Message Center, Student Loan Calculator
 *   - Dropdown menus with cascading sub-menus (CSS + JS hybrid)
 *   - Borrower Search input + Advanced Search modal
 *
 * Brand: Navy (#1a2744) default, Crimson (#b31e3c) hover/active — no Stretto, no green.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubSubItem {
  label: string;
  icon?: React.ReactNode;
  href?: string;
}

interface SubItem {
  label: string;
  href?: string;          // if set, renders a <Link> instead of a <button>
  action?: string;        // if set, fires a named callback instead of navigating
  icon?: React.ReactNode; // optional leading icon
  items?: SubSubItem[];   // if set, renders a cascading fly-out sub-menu
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;        // if set (and no dropdown), renders a direct <Link>
  dropdown?: SubItem[];
}

// ── Nav definitions ───────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: <HomeIcon />,
    href: "/admin/dashboard",
  },
  {
    id: "discharge-snapshot",
    label: "Discharge SnapShot",
    icon: <DischargeIcon />,
    dropdown: [
      { label: "Start New",     href: "/admin/discharge-snapshots/new",  icon: <FilePlusIcon /> },
      { label: "Invite New",    action: "invite-borrower" },
      { label: "View Existing", href: "/admin/discharge-snapshots",      icon: <ListIcon /> },
    ],
  },
  {
    id: "bk-analyzer",
    label: "Bankruptcy Discharge Analyzer",
    icon: <BKAnalyzerIcon />,
    dropdown: [
      {
        label: "General Info",
        icon: <InfoIcon />,
        items: [
          { label: "About",          icon: <InfoIcon /> },
          { label: "Instructions",   icon: <BookOpenIcon /> },
          { label: "Pricing",        icon: <DollarSignIcon /> },
          { label: "Questionnaire",  icon: <FileTextIcon /> },
          { label: "Sample Retainer",icon: <FileSignatureIcon /> },
        ],
      },
      { label: "Start New",      icon: <PlusCircleIcon /> },
      { label: "Submit to AUSA", icon: <SendIcon /> },
      {
        label: "View",
        icon: <FolderIcon />,
        items: [
          { label: "View Archived", icon: <ArchiveIcon /> },
          { label: "View Existing", icon: <SubListIcon /> },
        ],
      },
    ],
  },
  {
    id: "repayment-analyzer",
    label: "Repayment Plan Analyzer",
    icon: <RepaymentIcon />,
    dropdown: [
      {
        label: "General Info",
        icon: <InfoIcon />,
        items: [
          { label: "About",         icon: <InfoIcon /> },
          { label: "Instructions",  icon: <BookOpenIcon /> },
          { label: "Pricing",       icon: <DollarSignIcon /> },
          { label: "Questionnaire", icon: <FileTextIcon /> },
        ],
      },
      { label: "Start New",           icon: <PlusCircleIcon /> },
      { label: "Submit to Servicer",  icon: <SendIcon /> },
      {
        label: "View",
        icon: <FolderIcon />,
        items: [
          { label: "View Archived", icon: <ArchiveIcon /> },
          { label: "View Existing", icon: <SubListIcon /> },
        ],
      },
    ],
  },
  {
    id: "message-center",
    label: "Message Center",
    icon: <MessageIcon />,
  },
  {
    id: "student-loan-calc",
    label: "Student Loan Calculator",
    icon: <CalculatorIcon />,
    href: "/admin/student-loan-calculator",
  },
];

// ── Jurisdiction list ─────────────────────────────────────────────────────────

const JURISDICTIONS = [
  "Alabama - Northern District", "Alabama - Middle District", "Alabama - Southern District",
  "Alaska", "Arizona", "Arkansas - Eastern District", "Arkansas - Western District",
  "California - Northern District", "California - Eastern District",
  "California - Central District", "California - Southern District",
  "Colorado", "Connecticut", "Delaware", "District of Columbia",
  "Florida - Northern District", "Florida - Middle District", "Florida - Southern District",
  "Georgia - Northern District", "Georgia - Middle District", "Georgia - Southern District",
  "Hawaii", "Idaho",
  "Illinois - Northern District", "Illinois - Central District", "Illinois - Southern District",
  "Indiana - Northern District", "Indiana - Southern District",
  "Iowa - Northern District", "Iowa - Southern District",
  "Kansas", "Kentucky - Eastern District", "Kentucky - Western District",
  "Louisiana - Eastern District", "Louisiana - Middle District", "Louisiana - Western District",
  "Maine", "Maryland", "Massachusetts",
  "Michigan - Eastern District", "Michigan - Western District",
  "Minnesota", "Mississippi - Northern District", "Mississippi - Southern District",
  "Missouri - Eastern District", "Missouri - Western District",
  "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York - Northern District", "New York - Eastern District",
  "New York - Southern District", "New York - Western District",
  "North Carolina - Eastern District", "North Carolina - Middle District",
  "North Carolina - Western District", "North Dakota",
  "Ohio - Northern District", "Ohio - Southern District",
  "Oklahoma - Northern District", "Oklahoma - Eastern District", "Oklahoma - Western District",
  "Oregon", "Pennsylvania - Eastern District", "Pennsylvania - Middle District",
  "Pennsylvania - Western District", "Puerto Rico", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee - Eastern District", "Tennessee - Middle District",
  "Tennessee - Western District", "Texas - Northern District", "Texas - Eastern District",
  "Texas - Southern District", "Texas - Western District",
  "Utah", "Vermont", "Virgin Islands",
  "Virginia - Eastern District", "Virginia - Western District",
  "Washington - Eastern District", "Washington - Western District",
  "West Virginia - Northern District", "West Virginia - Southern District",
  "Wisconsin - Eastern District", "Wisconsin - Western District", "Wyoming",
];

// ── Advanced search params ────────────────────────────────────────────────────

interface AdvancedSearchParams {
  firstName: string;
  lastName: string;
  jurisdiction: string;
  caseNumber: string;
}

// ── Main component ────────────────────────────────────────────────────────────

/** Read a cookie value by name from document.cookie (client-side only). */
function getClientCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)  
  );
  return match ? decodeURIComponent(match[1]) : "";
}

export default function ToolNavigationBar() {
  const [activeNav, setActiveNav] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showBorrowerInvite, setShowBorrowerInvite] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [advForm, setAdvForm] = useState<AdvancedSearchParams>({
    firstName: "",
    lastName: "",
    jurisdiction: "",
    caseNumber: "",
  });

  const navRef = useRef<HTMLDivElement>(null);

  // Close nav dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveNav(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Lock scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showModal]);

  const handleNavClick = useCallback((id: string, hasDropdown: boolean) => {
    if (hasDropdown) {
      setActiveNav(prev => (prev === id ? null : id));
    } else {
      setActiveNav(null);
    }
  }, []);

  const handleDropdownAction = useCallback((action: string) => {
    setActiveNav(null); // always close the dropdown first
    if (action === "invite-borrower") {
      setAdminToken(getClientCookie("admin_session"));
      setShowBorrowerInvite(true);
    }
  }, []);

  const handleAdvancedSearch = useCallback(() => {
    // Wire to real search handler when available
    setShowModal(false);
  }, []);

  return (
    <>
      {/* ── Tool nav bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#dde2ea] flex items-center justify-between px-4 shrink-0">

        {/* Icon nav */}
        <nav
          ref={navRef}
          className="flex items-stretch"
          aria-label="Tool navigation"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id;
            const baseClass = `
              flex flex-col items-center justify-center gap-1
              px-4 py-3 min-w-[68px] border-b-2 transition-all duration-150
              cursor-pointer text-center focus-visible:outline-none
              ${isActive
                ? "border-[#b31e3c] text-[#b31e3c] bg-[#fdf0ee]"
                : "border-transparent text-[#4b5563] hover:text-[#b31e3c] hover:border-[#b31e3c] hover:bg-[#fdf8f7]"
              }
            `;
            return (
              <div key={item.id} className="relative">
                {/* Home links to /admin/dashboard; others are dropdown buttons */}
                {item.href ? (
                  <Link
                    href={item.href}
                    id={`tool-nav-${item.id}`}
                    className={baseClass}
                    onClick={() => setActiveNav(null)}
                  >
                    <span className="text-current">{item.icon}</span>
                    <span className="text-[0.6875rem] font-medium leading-tight whitespace-nowrap">
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <button
                    id={`tool-nav-${item.id}`}
                    onClick={() => handleNavClick(item.id, !!item.dropdown)}
                    className={baseClass}
                    aria-haspopup={item.dropdown ? "true" : undefined}
                    aria-expanded={isActive}
                  >
                    <span className="text-current">{item.icon}</span>
                    <span className="text-[0.6875rem] font-medium leading-tight whitespace-nowrap flex items-center gap-0.5">
                      {item.label}
                      {item.dropdown && (
                        <span className={`ml-0.5 transition-transform duration-150 ${isActive ? "rotate-180" : ""}`}>
                          <ChevronDownSmIcon />
                        </span>
                      )}
                    </span>
                  </button>
                )}

                {/* Dropdown */}
                {item.dropdown && isActive && (
                  <ToolNavDropdown
                    items={item.dropdown}
                    onClose={() => setActiveNav(null)}
                    onAction={handleDropdownAction}
                  />
                )}
              </div>
            );
          })}
        </nav>

        {/* Search area */}
        <div className="flex items-center gap-2 py-2 shrink-0">
          {/* Basic search */}
          <div className="flex items-center border border-[#dde2ea] rounded bg-[#f9fafb] overflow-hidden">
            <input
              id="tool-borrower-search-input"
              type="text"
              placeholder="Borrower Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && console.log("search:", searchQuery)}
              className="px-3 py-1.5 text-[0.8125rem] bg-transparent outline-none w-44 placeholder:text-[#9ca3af] text-[#374151]"
              aria-label="Borrower Search"
            />
            <button
              id="tool-borrower-search-btn"
              onClick={() => console.log("search:", searchQuery)}
              className="px-2.5 py-1.5 text-[#9ca3af] hover:text-[#b31e3c] transition-colors duration-150 cursor-pointer border-l border-[#dde2ea]"
              aria-label="Search"
            >
              <SearchIcon />
            </button>
          </div>

          {/* Advanced Search */}
          <button
            id="tool-advanced-search-btn"
            onClick={() => setShowModal(true)}
            className="
              px-3.5 py-1.5 text-[0.8125rem] font-semibold rounded
              border border-[#b31e3c] text-[#b31e3c] bg-white
              hover:bg-[#b31e3c] hover:text-white
              transition-colors duration-150 cursor-pointer whitespace-nowrap
            "
          >
            Advanced Search
          </button>
        </div>
      </div>

      {/* ── Advanced Search Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <AdvancedSearchModal
          form={advForm}
          onChange={setAdvForm}
          onSearch={handleAdvancedSearch}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Invite Borrower Modal (Discharge SnapShot → Invite New) ───────────── */}
      {showBorrowerInvite && (
        <InviteBorrowerModal
          adminToken={adminToken}
          autoOpen
          onClose={() => setShowBorrowerInvite(false)}
        />
      )}
    </>
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function ToolNavDropdown({
  items,
  onClose,
  onAction,
}: {
  items: SubItem[];
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <div
      role="menu"
      className="absolute top-full left-0 mt-0 w-52 bg-white border border-[#dde2ea] rounded-b-lg shadow-lg z-[200] py-1"
    >
      {items.map((item, i) => (
        <div key={i} className="relative group/sub">
          {/* Render Link if href present, action button if action set, otherwise plain button */}
          {item.href ? (
            <Link
              href={item.href}
              role="menuitem"
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[0.875rem] text-[#374151] hover:bg-[#fdf0ee] hover:text-[#b31e3c] transition-colors duration-100"
              onClick={onClose}
            >
              {item.icon && (
                <span className="text-[#b31e3c] opacity-70 shrink-0">
                  {item.icon}
                </span>
              )}
              {item.label}
            </Link>
          ) : item.action ? (
            <button
              role="menuitem"
              id={`tool-nav-action-${item.action}`}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[0.875rem] text-[#374151] hover:bg-[#fdf0ee] hover:text-[#b31e3c] transition-colors duration-100 cursor-pointer"
              onClick={() => onAction(item.action!)}
            >
              <span className="text-[#b31e3c] opacity-70">
                <InviteIcon />
              </span>
              {item.label}
            </button>
          ) : (
            <button
              role="menuitem"
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-[0.875rem] text-[#374151] hover:bg-[#fdf0ee] hover:text-[#b31e3c] transition-colors duration-100 cursor-pointer ${
                item.items ? "justify-between" : ""
              }`}
              onClick={() => !item.items && onClose()}
            >
              <span className="flex items-center gap-2">
                {item.icon && (
                  <span className="text-[#b31e3c] opacity-70 shrink-0">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </span>
              {item.items && (
                <span className="text-[#9ca3af]">
                  <ChevronRightIcon />
                </span>
              )}
            </button>
          )}

          {/* Cascading sub-menu */}
          {item.items && (
            <div
              role="menu"
              className="absolute left-full top-0 w-44 bg-white border border-[#dde2ea] rounded-lg shadow-lg py-1 opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all duration-150 z-[210]"
            >
              {item.items.map((sub, j) => (
                <button
                  key={j}
                  role="menuitem"
                  className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[0.875rem] text-[#374151] hover:bg-[#fdf0ee] hover:text-[#b31e3c] transition-colors duration-100 cursor-pointer"
                  onClick={onClose}
                >
                  {sub.icon && (
                    <span className="text-[#b31e3c] opacity-70 shrink-0">
                      {sub.icon}
                    </span>
                  )}
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Advanced Search Modal ─────────────────────────────────────────────────────

function AdvancedSearchModal({
  form,
  onChange,
  onSearch,
  onClose,
}: {
  form: AdvancedSearchParams;
  onChange: (p: AdvancedSearchParams) => void;
  onSearch: () => void;
  onClose: () => void;
}) {
  const set = (key: keyof AdvancedSearchParams) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...form, [key]: e.target.value });

  return (
    <div
      id="tool-advanced-search-overlay"
      className="fixed inset-0 z-[500] flex items-start justify-center pt-[100px]"
      style={{ background: "rgba(26,39,68,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Advanced Borrower Search"
    >
      <div className="bg-white rounded-xl shadow-2xl w-[min(90vw,580px)] relative animate-slide-in">
        {/* Close */}
        <button
          id="tool-adv-search-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9ca3af] hover:text-[#374151] transition-colors duration-150 cursor-pointer p-1"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="px-8 pt-8 pb-8">
          <h2 className="font-sans text-[1.25rem] font-bold text-[#1a2744] mb-6">
            Advanced Borrower Search
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <input
              id="tool-adv-first-name"
              type="text"
              placeholder="First Name"
              value={form.firstName}
              onChange={set("firstName")}
              className="w-full border border-[#dde2ea] rounded-lg px-4 py-3 text-[0.9rem] text-[#1a2744] placeholder:text-[#9ca3af] outline-none focus:border-[#b31e3c] focus:ring-2 focus:ring-[#b31e3c]/12 transition-all duration-150"
            />
            <input
              id="tool-adv-last-name"
              type="text"
              placeholder="Last Name"
              value={form.lastName}
              onChange={set("lastName")}
              className="w-full border border-[#dde2ea] rounded-lg px-4 py-3 text-[0.9rem] text-[#1a2744] placeholder:text-[#9ca3af] outline-none focus:border-[#b31e3c] focus:ring-2 focus:ring-[#b31e3c]/12 transition-all duration-150"
            />
            <div className="relative">
              <select
                id="tool-adv-jurisdiction"
                value={form.jurisdiction}
                onChange={set("jurisdiction")}
                className="w-full border border-[#dde2ea] rounded-lg px-4 py-3 text-[0.9rem] text-[#1a2744] outline-none focus:border-[#b31e3c] focus:ring-2 focus:ring-[#b31e3c]/12 transition-all duration-150 appearance-none bg-white cursor-pointer"
              >
                <option value="" disabled>Select Jurisdiction</option>
                {JURISDICTIONS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">
                <ChevronDownSmIcon />
              </span>
            </div>
            <input
              id="tool-adv-case-number"
              type="text"
              placeholder="Bankruptcy Case Number"
              value={form.caseNumber}
              onChange={set("caseNumber")}
              className="w-full border border-[#dde2ea] rounded-lg px-4 py-3 text-[0.9rem] text-[#1a2744] placeholder:text-[#9ca3af] outline-none focus:border-[#b31e3c] focus:ring-2 focus:ring-[#b31e3c]/12 transition-all duration-150"
            />
          </div>

          <div className="flex justify-end mt-2">
            <button
              id="tool-adv-search-submit-btn"
              onClick={onSearch}
              className="px-8 py-3 bg-[#1d4ed8] text-white font-bold text-[0.9rem] tracking-widest uppercase rounded-lg hover:bg-[#1e40af] transition-colors duration-150 cursor-pointer shadow-md"
            >
              SEARCH
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function DischargeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h6M9 13h4" />
      <path d="M16 17l2-2-2-2" />
    </svg>
  );
}

function BKAnalyzerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="8 13 10 15 14 11" />
    </svg>
  );
}

function RepaymentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="5" />
      <path d="M12 13v8M8 17h8" />
      <path d="M10 6.5h4M12 5v3" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CalculatorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10" strokeWidth="2" />
      <line x1="12" y1="10" x2="12" y2="10" strokeWidth="2" />
      <line x1="16" y1="10" x2="16" y2="10" strokeWidth="2" />
      <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2" />
      <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2" />
      <line x1="16" y1="14" x2="16" y2="18" strokeWidth="2" />
      <line x1="8" y1="18" x2="8" y2="18" strokeWidth="2" />
      <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronDownSmIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function InviteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function FilePlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

// ── Analyzer dropdown icons ────────────────────────────────────────────────────

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function DollarSignIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function FileSignatureIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L18 5.5" />
      <path d="M8 18h1l7-7-1-1-7 7z" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3" />
    </svg>
  );
}

function PlusCircleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function SubListIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
