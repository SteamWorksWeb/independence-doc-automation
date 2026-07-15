/**
 * src/app/admin/cases/[id]/page.tsx
 *
 * Case Detail Page — Skeleton (Phase 1)
 *
 * Displays layout placeholders for Case Overview, Document Generation,
 * Case Files, and Internal Notes. Data fetching will be wired in a
 * subsequent phase.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Case Detail",
};

// ── Icon helpers ───────────────────────────────────────────────────────────────

function IconOverview() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function IconDocGen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconFiles() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconNotes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ── Skeleton placeholder row ───────────────────────────────────────────────────

function SkeletonRow({ widths }: { widths: string[] }) {
  return (
    <div className="flex items-center gap-3">
      {widths.map((w, i) => (
        <div key={i} className={`h-4 rounded bg-gray-100 ${w}`} />
      ))}
    </div>
  );
}

// ── Section card wrapper ───────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e5e8ed] rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e8ed]">
        <div className="flex items-center gap-2.5 text-[#1a2744]">
          <span className="text-[#1a2744] opacity-60">{icon}</span>
          <h2 className="font-serif text-[0.9375rem] font-bold tracking-[0.01em]">{title}</h2>
        </div>
        {badge && (
          <span className="text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-[#9ca3af] bg-[#f3f4f6] px-2.5 py-1 rounded-md">
            {badge}
          </span>
        )}
      </div>
      {/* Card body */}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-[#f7f8fa] p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Back nav + header ── */}
        <div className="space-y-3">
          <Link
            href="/admin/cases"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[#6b7280] hover:text-[#1a2744] transition-colors duration-150"
          >
            <IconBack />
            Back to Cases
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-serif text-[1.625rem] font-black text-[#1a2744] leading-tight">
                Managing Case: <span className="text-crimson">{id}</span>
              </h1>
              <p className="mt-1 text-[0.875rem] text-[#6b7280]">
                Full case details and document management
              </p>
            </div>
            {/* Status badge placeholder */}
            <span className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-semibold bg-[#fff7ed] text-[#d97706] border border-[#fde68a] self-start sm:self-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden />
              Awaiting Data
            </span>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column — spans 2/3 on large screens */}
          <div className="lg:col-span-2 space-y-6">

            {/* Case Overview */}
            <SectionCard icon={<IconOverview />} title="Case Overview" badge="Coming Soon">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    { label: "Case ID", width: "w-28" },
                    { label: "Client Name", width: "w-36" },
                    { label: "Case Type", width: "w-32" },
                    { label: "Priority", width: "w-16" },
                    { label: "Status", width: "w-24" },
                    { label: "Assigned Attorney", width: "w-40" },
                    { label: "Date Opened", width: "w-28" },
                    { label: "Last Updated", width: "w-28" },
                  ].map(({ label, width }) => (
                    <div key={label} className="space-y-1.5">
                      <p className="text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-[#9ca3af]">
                        {label}
                      </p>
                      <div className={`h-4 rounded bg-gray-100 ${width}`} />
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* Document Generation */}
            <SectionCard icon={<IconDocGen />} title="Document Generation" badge="Coming Soon">
              <div className="space-y-3">
                <p className="text-[0.875rem] text-[#6b7280] leading-relaxed">
                  Generate DD-293, DD-149, personal statements, and supporting documents for this case.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {["DD-293 Application", "DD-149 Appeal", "Personal Statement", "Supporting Letter"].map((doc) => (
                    <div
                      key={doc}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-[#e5e8ed] bg-[#f7f8fa] opacity-60"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[#9ca3af]"><IconDocGen /></span>
                        <span className="text-[0.8125rem] font-semibold text-[#374151]">{doc}</span>
                      </div>
                      <span className="text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-[#9ca3af]">
                        Soon
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

          </div>

          {/* Right column — 1/3 on large screens */}
          <div className="space-y-6">

            {/* Case Files */}
            <SectionCard icon={<IconFiles />} title="Case Files" badge="Coming Soon">
              <div className="space-y-3">
                <p className="text-[0.8125rem] text-[#6b7280] leading-relaxed">
                  Uploaded documents, evidence, and correspondence will appear here.
                </p>
                <div className="space-y-2 pt-1">
                  <SkeletonRow widths={["w-5 h-5 rounded", "flex-1"]} />
                  <SkeletonRow widths={["w-5 h-5 rounded", "flex-1"]} />
                  <SkeletonRow widths={["w-5 h-5 rounded", "flex-1"]} />
                </div>
                <button
                  disabled
                  className="mt-2 w-full py-2 px-4 rounded-lg border border-dashed border-[#d1d5db] text-[0.8125rem] font-semibold text-[#9ca3af] cursor-not-allowed"
                >
                  + Upload File
                </button>
              </div>
            </SectionCard>

            {/* Internal Notes */}
            <SectionCard icon={<IconNotes />} title="Internal Notes" badge="Coming Soon">
              <div className="space-y-3">
                <p className="text-[0.8125rem] text-[#6b7280] leading-relaxed">
                  Private staff notes and case history will appear here.
                </p>
                <div className="space-y-3 pt-1">
                  {[1, 2].map((i) => (
                    <div key={i} className="space-y-1.5 p-3 bg-[#f7f8fa] rounded-lg border border-[#e5e8ed]">
                      <div className="h-3 w-20 bg-gray-100 rounded" />
                      <div className="h-3 w-full bg-gray-100 rounded" />
                      <div className="h-3 w-3/4 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
                <button
                  disabled
                  className="mt-2 w-full py-2 px-4 rounded-lg border border-dashed border-[#d1d5db] text-[0.8125rem] font-semibold text-[#9ca3af] cursor-not-allowed"
                >
                  + Add Note
                </button>
              </div>
            </SectionCard>

          </div>
        </div>
      </div>
    </div>
  );
}
