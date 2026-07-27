"use client";

/**
 * src/components/lawyer/BorrowerGrid.tsx
 *
 * Borrower Accounts Data Grid — filterable tab system + data table.
 * Shows "No results found" when no borrower records match the active tab.
 */

import React, { useState } from "react";

// ── Tab definitions ───────────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  count: number;
}

const TABS: Tab[] = [
  { id: "new",                   label: "New",                   count: 0   },
  { id: "open",                  label: "Open",                  count: 0   },
  { id: "doc-review",            label: "Doc Review Complete",   count: 0   },
  { id: "incomplete",            label: "Incomplete",            count: 0   },
  { id: "decision-reported",     label: "Decision Reported",     count: 0   },
  { id: "closed",                label: "Closed",                count: 0   },
  { id: "rejected",              label: "Rejected",              count: 0   },
  { id: "saved",                 label: "Saved",                 count: 0   },
  { id: "all",                   label: "All",                   count: 0   },
  { id: "student-loans",         label: "Student Loans",         count: 6   },
  { id: "bk-discharges",         label: "BK Discharges",         count: 780 },
  { id: "archived",              label: "Archived",              count: 0   },
  { id: "archived-bk",          label: "Archived BK Discharges",count: 8   },
];

// ── Column headers ────────────────────────────────────────────────────────────

const COLUMNS = [
  "Borrower Name",
  "Case Number",
  "Jurisdiction",
  "Status",
  "Last Updated",
  "Attorney",
  "Actions",
];

// ── Main Component ────────────────────────────────────────────────────────────

export interface BorrowerGridProps {
  defaultTab?: string;
}

export default function BorrowerGrid({ defaultTab = "bk-discharges" }: BorrowerGridProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  const currentTab = TABS.find((t) => t.id === activeTab);

  return (
    <section className="bg-white border border-[#dde2ea] rounded-lg shadow-sm overflow-hidden">

      {/* ── Section heading ──────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-[#eceef2]">
        <h1 className="font-sans font-semibold text-[1.125rem] text-[#1a2744] m-0">
          Borrower Accounts
        </h1>
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <div className="overflow-x-auto border-b border-[#dde2ea]">
        <div className="flex items-stretch min-w-max" role="tablist" aria-label="Borrower account filter tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-3 text-[0.8rem] font-medium
                  whitespace-nowrap border-r border-[#dde2ea] last:border-r-0
                  transition-colors duration-150 cursor-pointer
                  ${isActive
                    ? "bg-[#22a060] text-white"
                    : "bg-white text-[#6b7280] hover:bg-[#f0fdf4] hover:text-[#22a060]"
                  }
                `}
              >
                <span className={`font-bold tabular-nums ${isActive ? "text-white" : "text-[#374151]"}`}>
                  ({tab.count})
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Data table ───────────────────────────────────────────────────── */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        {/* Column headers */}
        <div className="grid border-b border-[#eceef2] bg-[#f9fafb]"
          style={{ gridTemplateColumns: "2fr 1.5fr 2fr 1fr 1.2fr 1.2fr 1fr" }}
        >
          {COLUMNS.map((col) => (
            <div
              key={col}
              className="px-4 py-2.5 text-[0.75rem] font-semibold text-[#6b7280] uppercase tracking-wider"
            >
              {col}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {(currentTab?.count ?? 0) === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <EmptyStateIcon />
            <p className="text-[0.9375rem] text-[#6b7280] font-medium">No results found</p>
            <p className="text-[0.8125rem] text-[#9ca3af]">
              There are no borrower records in the &ldquo;{currentTab?.label}&rdquo; category.
            </p>
          </div>
        ) : (
          /* Mock rows for tabs with non-zero counts */
          <MockRows tab={currentTab!} />
        )}
      </div>
    </section>
  );
}

// ── Mock rows (for tabs with count > 0) ──────────────────────────────────────

function MockRows({ tab }: { tab: Tab }) {
  // Show a few illustrative placeholder rows
  const mockCount = Math.min(tab.count, 5);

  return (
    <div>
      {Array.from({ length: mockCount }).map((_, i) => (
        <div
          key={i}
          className="grid border-b border-[#f3f4f6] hover:bg-[#f9fafb] transition-colors duration-100"
          style={{ gridTemplateColumns: "2fr 1.5fr 2fr 1fr 1.2fr 1.2fr 1fr" }}
        >
          <div className="px-4 py-3.5 text-[0.875rem] text-[#374151] font-medium">
            <div className="h-3.5 bg-[#e5e7eb] rounded animate-pulse w-32" />
          </div>
          <div className="px-4 py-3.5">
            <div className="h-3.5 bg-[#e5e7eb] rounded animate-pulse w-24" />
          </div>
          <div className="px-4 py-3.5">
            <div className="h-3.5 bg-[#e5e7eb] rounded animate-pulse w-36" />
          </div>
          <div className="px-4 py-3.5">
            <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-[#dcfce7] text-[#16a34a]">
              Active
            </span>
          </div>
          <div className="px-4 py-3.5">
            <div className="h-3.5 bg-[#e5e7eb] rounded animate-pulse w-20" />
          </div>
          <div className="px-4 py-3.5">
            <div className="h-3.5 bg-[#e5e7eb] rounded animate-pulse w-24" />
          </div>
          <div className="px-4 py-3.5">
            <button className="text-[0.8125rem] text-[#22a060] font-medium hover:underline cursor-pointer">
              View
            </button>
          </div>
        </div>
      ))}

      {tab.count > 5 && (
        <div className="px-4 py-3 text-center text-[0.8125rem] text-[#9ca3af]">
          Showing 5 of {tab.count} records
        </div>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function EmptyStateIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
