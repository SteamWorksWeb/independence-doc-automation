/**
 * src/app/admin/cases/[id]/page.tsx
 *
 * Case Detail Page — War Room (Phase 2: Live Data)
 *
 * Async Server Component that fetches case data directly from the backend
 * using the admin_session JWT. Renders the full case overview, document
 * list, doc generation panel, and internal notes shell.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Case Detail",
};

export const maxDuration = 60;

// ── Backend types ──────────────────────────────────────────────────────────────

interface CaseDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
  createdAt?: string;
}

interface CaseData {
  id: string;
  name?: string;           // May come from top-level or client relation
  email?: string;
  status: string;
  createdAt: string;
  intakeProfile?: Record<string, unknown> | null;
  documents: CaseDocument[];
  client?: {
    id: string;
    email?: string;
    name?: string;
  };
}

// ── Data fetching ──────────────────────────────────────────────────────────────

type FetchResult =
  | { caseData: CaseData; error: null; notFound: false }
  | { caseData: null; error: string; notFound: boolean };

async function fetchCase(id: string): Promise<FetchResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    console.error("[case-detail] FAIL: No admin_session cookie found.");
    return { caseData: null, error: "Unauthorized: No active admin session.", notFound: false };
  }

  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error("[case-detail] FAIL: NEXT_PUBLIC_AWS_API_URL is undefined.");
    return { caseData: null, error: "Server configuration error.", notFound: false };
  }

  const targetUrl = `${backendBase}/admin/cases/${id}`;
  console.log(`[case-detail] Fetching: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    console.log(`[case-detail] Backend responded: ${res.status} ${res.statusText}`);

    if (res.status === 404) {
      return { caseData: null, error: "Case not found.", notFound: true };
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(could not read response body)");
      console.error(
        `[case-detail] FAIL: Backend returned ${res.status}`,
        `| URL: ${targetUrl}`,
        `| Body: ${errorText.slice(0, 500)}`
      );
      return { caseData: null, error: `Backend error (${res.status}). Please check server logs.`, notFound: false };
    }

    const data = await res.json();
    // Backend returns { case: { ... } }
    const caseData: CaseData = data.case ?? data;
    console.log(`[case-detail] SUCCESS: Loaded case ${caseData.id}`);
    return { caseData, error: null, notFound: false };
  } catch (error) {
    console.error("[case-detail] FETCH EXCEPTION:", error);
    return {
      caseData: null,
      error: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      notFound: false,
    };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function getClientName(c: CaseData): string {
  return c.name ?? c.client?.name ?? c.email ?? c.client?.email ?? "Unknown Client";
}

// ── Status badge ───────────────────────────────────────────────────────────────

type StatusVariant = "pending" | "active" | "approved" | "rejected" | "default";

function resolveStatusVariant(status: string): StatusVariant {
  const s = status.toLowerCase();
  if (s.includes("pending") || s.includes("intake")) return "pending";
  if (s.includes("active") || s.includes("review")) return "active";
  if (s.includes("approved") || s.includes("closed")) return "approved";
  if (s.includes("rejected") || s.includes("denied")) return "rejected";
  return "default";
}

const statusStyles: Record<StatusVariant, string> = {
  pending:  "bg-[#fff7ed] text-[#d97706] border border-[#fde68a]",
  active:   "bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]",
  approved: "bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]",
  rejected: "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]",
  default:  "bg-[#f3f4f6] text-[#6b7280] border border-[#e5e7eb]",
};

function StatusBadge({ status }: { status: string }) {
  const variant = resolveStatusVariant(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-semibold self-start sm:self-auto ${statusStyles[variant]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {status}
    </span>
  );
}

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

function IconFileItem() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
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

// ── Overview field ─────────────────────────────────────────────────────────────

function OverviewField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-[#9ca3af]">
        {label}
      </p>
      <p className="text-[0.9375rem] font-semibold text-[#1a2744] leading-snug">
        {value ?? "—"}
      </p>
    </div>
  );
}

// ── Error state ────────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#f7f8fa] p-6 md:p-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-white border border-[#e5e8ed] rounded-xl shadow-sm p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto text-[#dc2626]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="font-serif text-[1.125rem] font-bold text-[#1a2744]">Failed to Load Case</h1>
        <p className="text-[0.9rem] text-[#6b7280] leading-relaxed">{message}</p>
        <Link
          href="/admin/cases"
          className="inline-flex items-center gap-1.5 mt-2 text-[0.8125rem] font-semibold text-[#1a2744] hover:underline"
        >
          <IconBack />
          Back to Cases
        </Link>
      </div>
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

  const result = await fetchCase(id);

  // Hard 404 — use Next.js notFound() to render the closest not-found.tsx
  if (result.notFound) {
    notFound();
  }

  // Soft error — render an in-page error state
  if (result.error || !result.caseData) {
    return <ErrorState message={result.error ?? "An unexpected error occurred."} />;
  }

  const { caseData } = result;
  const clientName = getClientName(caseData);
  const documents = caseData.documents ?? [];

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
                Managing Case:{" "}
                <span className="text-crimson">{clientName}</span>
              </h1>
              <p className="mt-1 text-[0.875rem] text-[#6b7280]">
                Full case details and document management
              </p>
            </div>
            <StatusBadge status={caseData.status} />
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column — spans 2/3 on large screens */}
          <div className="lg:col-span-2 space-y-6">

            {/* Case Overview */}
            <SectionCard icon={<IconOverview />} title="Case Overview">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <OverviewField label="Case ID" value={
                  <span className="font-mono text-[0.8125rem] text-[#6b7280] break-all">{caseData.id}</span>
                } />
                <OverviewField label="Client Name" value={clientName} />
                <OverviewField label="Email" value={
                  <span className="text-[0.8750rem] break-all">{caseData.email ?? caseData.client?.email ?? "—"}</span>
                } />
                <OverviewField label="Status" value={<StatusBadge status={caseData.status} />} />
                <OverviewField label="Date Opened" value={formatDate(caseData.createdAt)} />
                <OverviewField
                  label="Intake Complete"
                  value={
                    caseData.intakeProfile
                      ? ((caseData.intakeProfile as { isCompleted?: boolean }).isCompleted
                          ? "✓ Yes"
                          : "In Progress")
                      : "Not Started"
                  }
                />
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
            <SectionCard icon={<IconFiles />} title="Case Files">
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="py-6 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-[#f3f4f6] flex items-center justify-center mx-auto text-[#9ca3af]">
                      <IconFiles />
                    </div>
                    <p className="text-[0.8125rem] text-[#9ca3af] font-medium">
                      No documents uploaded yet.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {documents.map((doc) => (
                      <li key={doc.id}>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 p-3 rounded-lg border border-[#e5e8ed] bg-[#f7f8fa] hover:bg-[#eff6ff] hover:border-[#bfdbfe] transition-colors duration-150 group"
                        >
                          <span className="text-[#9ca3af] group-hover:text-[#2563eb] transition-colors duration-150 flex-shrink-0">
                            <IconFileItem />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.8125rem] font-semibold text-[#374151] group-hover:text-[#1d4ed8] truncate transition-colors duration-150">
                              {doc.fileName}
                            </p>
                            {(doc.uploadedAt ?? doc.createdAt) && (
                              <p className="text-[0.6875rem] text-[#9ca3af] mt-0.5">
                                {formatDate(doc.uploadedAt ?? doc.createdAt)}
                              </p>
                            )}
                          </div>
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="flex-shrink-0 text-[#9ca3af] group-hover:text-[#2563eb] transition-colors duration-150"
                            aria-hidden
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
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
