/**
 * src/app/admin/cases/page.tsx
 *
 * Case Management Dashboard — Phase 1
 *
 * Migrated from CSS Modules → Tailwind CSS (Phase 2).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";

export const metadata: Metadata = {
  title: "Case Management",
};

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntakeProfile {
  isCompleted: boolean;
  [key: string]: unknown;
}

interface Client {
  id: string;
  email: string;
  createdAt: string;
  isVerified: boolean;
  intakeProfile: IntakeProfile | null;
}

type CaseStatus = "In Progress" | "Awaiting Documents" | "Under Review" | "Submitted" | "Closed";
type CaseType = "Discharge Upgrade" | "Medical Board" | "Benefits Appeal" | "General Inquiry";
type CasePriority = "high" | "medium" | "low";

interface CaseRow {
  caseId: string;
  clientName: string;
  clientId: string;
  caseType: CaseType;
  status: CaseStatus;
  priority: CasePriority;
  lastUpdated: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function deriveCaseFromClient(client: Client, index: number): CaseRow | null {
  if (!client.isVerified) return null;

  const caseNum = String(index + 1).padStart(4, "0");
  const caseId = `ILF-2026-${caseNum}`;
  const clientName = client.email.split("@")[0] ?? client.email;

  const caseTypes: CaseType[] = ["Discharge Upgrade", "Medical Board", "Benefits Appeal", "General Inquiry"];
  const caseType = caseTypes[index % caseTypes.length];

  if (client.intakeProfile?.isCompleted) {
    return { caseId, clientName, clientId: client.id, caseType, status: "Under Review", priority: "high", lastUpdated: client.createdAt };
  }

  if (client.intakeProfile) {
    return { caseId, clientName, clientId: client.id, caseType, status: "In Progress", priority: "medium", lastUpdated: client.createdAt };
  }

  return { caseId, clientName, clientId: client.id, caseType, status: "Awaiting Documents", priority: "low", lastUpdated: client.createdAt };
}

// ── Secure data fetch ─────────────────────────────────────────────────────────

async function fetchCases(): Promise<{ cases: CaseRow[] | null; error: string | null }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    console.error("[cases] FAIL: No admin_session cookie found in Server Component.");
    return { cases: null, error: "Unauthorized: No active admin session." };
  }

  const masked = token.length > 10 ? `${token.slice(0, 5)}…${token.slice(-5)}` : "****";
  console.log(`[cases] admin_session token present: ${masked} (${token.length} chars)`);

  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error("[cases] FAIL: NEXT_PUBLIC_AWS_API_URL is undefined.",
      "Available env keys:", Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_")).join(", ") || "(none)");
    return { cases: null, error: "Server configuration error. Please check server logs." };
  }

  const targetUrl = `${backendBase}/admin/clients`;
  console.log(`[cases] Fetching clients to derive cases: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    console.log(`[cases] Backend responded: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(could not read response body)");
      console.error(`[cases] FAIL: Backend returned ${res.status}`, `| URL: ${targetUrl}`, `| Body: ${errorText.slice(0, 500)}`);
      return { cases: null, error: "Failed to load cases. Please check server logs." };
    }

    const data = await res.json();
    const raw: Client[] = Array.isArray(data) ? data : (data.clients ?? []);
    const cases: CaseRow[] = raw.map((c, i) => deriveCaseFromClient(c, i)).filter((c): c is CaseRow => c !== null);
    console.log(`[cases] SUCCESS: Derived ${cases.length} cases from ${raw.length} clients.`);
    return { cases, error: null };
  } catch (error) {
    console.error("[cases] FETCH EXCEPTION:", error);
    return { cases: null, error: `Network Exception: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function CasesPage() {
  const headersList = await headers();
  const adminEmail = headersList.get("x-admin-email") ?? "Administrator";

  const { cases, error } = await fetchCases();

  const total = cases?.length ?? 0;
  const inProgress = cases?.filter((c) => c.status === "In Progress" || c.status === "Under Review").length ?? 0;
  const awaiting = cases?.filter((c) => c.status === "Awaiting Documents").length ?? 0;
  const submitted = cases?.filter((c) => c.status === "Submitted" || c.status === "Closed").length ?? 0;

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] animate-fade-in">

      {/* ── Page header ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap max-[640px]:flex-col">
        <div>
          <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy mb-1 leading-[1.1]">
            Case Management
          </h1>
          <p className="text-sm text-text-muted">
            Signed in as <strong>{adminEmail}</strong>
          </p>
        </div>
        <div className="font-sans text-[0.8125rem] text-text-muted bg-white border border-border py-1.5 px-3.5 rounded-[20px] whitespace-nowrap self-start max-[640px]:self-stretch max-[640px]:text-center">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      {/* ── Stat strip ───────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-2 max-[640px]:gap-2.5 max-[400px]:grid-cols-1">
        <StatPill label="Total Active Cases" value={error ? "—" : String(total)} color="navy" />
        <StatPill label="In Progress" value={error ? "—" : String(inProgress)} color="info" />
        <StatPill label="Awaiting Documents" value={error ? "—" : String(awaiting)} color="warning" />
        <StatPill label="Submitted / Closed" value={error ? "—" : String(submitted)} color="muted" />
      </div>

      {/* ── Main table card ───────────────────────────────── */}
      <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="flex items-start justify-between py-5 px-6 border-b border-border gap-4 flex-wrap max-[640px]:flex-col">
          <div>
            <h2 className="font-serif text-[1.0625rem] font-bold text-navy mb-0.5">All Cases</h2>
            {!error && (
              <p className="text-[0.8125rem] text-text-muted">
                {total} {total === 1 ? "case" : "cases"} on file
              </p>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && <ErrorState message={error} />}

        {/* Empty state */}
        {!error && cases && cases.length === 0 && <EmptyState />}

        {/* Table */}
        {!error && cases && cases.length > 0 && (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full border-collapse text-sm min-w-[780px]" aria-label="Case management">
              <thead>
                <tr>
                  <th className="py-[11px] px-4 first:pl-6 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Case ID</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Client</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Case Type</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Priority</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Status</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Last Updated</th>
                  <th className="py-[11px] px-4 last:pr-6 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseRow) => (
                  <tr key={caseRow.caseId} className="border-b border-border last:border-b-0 transition-[background] duration-150 ease-in-out hover:bg-[#fafbfc]">
                    <td className="py-3.5 px-4 first:pl-6 font-sans text-[0.8125rem] font-semibold text-navy tracking-[0.02em] align-middle">
                      {caseRow.caseId}
                    </td>
                    <td className="py-3.5 px-4 font-medium align-middle text-text-primary">
                      {caseRow.clientName}
                    </td>
                    <td className="py-3.5 px-4 align-middle">
                      <span className="inline-flex items-center gap-[5px] py-[3px] px-[9px] rounded-md text-xs font-semibold bg-bg-alt text-text-secondary whitespace-nowrap">
                        <CaseTypeIcon type={caseRow.caseType} />
                        {caseRow.caseType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 align-middle">
                      <PriorityIndicator priority={caseRow.priority} />
                    </td>
                    <td className="py-3.5 px-4 align-middle">
                      <StatusBadge status={caseRow.status} />
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap text-[0.8125rem] align-middle">
                      {formatDate(caseRow.lastUpdated)}
                    </td>
                    <td className="py-3.5 px-4 last:pr-6 align-middle">
                      <Link
                        href={`/admin/cases/${caseRow.clientId}`}
                        className="text-[0.8125rem] font-semibold text-crimson no-underline whitespace-nowrap transition-[color] duration-fast hover:text-crimson-hover hover:underline"
                        title={`Manage case ${caseRow.caseId}`}
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!error && cases && cases.length > 0 && (
          <div className="py-3 px-6 border-t border-border bg-bg flex items-center justify-end">
            <span className="text-[0.8125rem] text-text-muted">
              Showing all {total} {total === 1 ? "case" : "cases"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: "navy" | "success" | "warning" | "muted" | "info" }) {
  const borderColorMap: Record<string, string> = { navy: "border-l-navy", success: "border-l-success", warning: "border-l-warning", muted: "border-l-border", info: "border-l-[#3b82f6]" };
  const valueColorMap: Record<string, string> = { navy: "text-navy", success: "text-success", warning: "text-warning", muted: "text-text-muted", info: "text-[#3b82f6]" };
  return (
    <div className={`bg-white border border-border rounded-lg py-4 px-5 flex flex-col gap-1 shadow-sm transition-[box-shadow,transform] duration-200 ease-in-out hover:shadow-md hover:-translate-y-px border-l-[3px] ${borderColorMap[color]}`}>
      <span className={`font-serif text-[1.875rem] font-black leading-none ${valueColorMap[color]}`}>{value}</span>
      <span className="text-xs font-semibold tracking-[0.05em] uppercase text-text-muted">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const variantMap: Record<CaseStatus, string> = {
    "In Progress": "bg-[#eff4ff] text-[#2563eb]",
    "Awaiting Documents": "bg-warning-bg text-warning",
    "Under Review": "bg-crimson-light text-crimson",
    "Submitted": "bg-success-bg text-success",
    "Closed": "bg-bg-alt text-text-muted",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${variantMap[status]}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80" aria-hidden />
      {status}
    </span>
  );
}

function PriorityIndicator({ priority }: { priority: CasePriority }) {
  const labelMap: Record<CasePriority, string> = { high: "High", medium: "Medium", low: "Low" };
  const dotColorMap: Record<CasePriority, string> = { high: "bg-crimson", medium: "bg-warning", low: "bg-success" };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColorMap[priority]}`} aria-hidden />
      <span className="text-[0.8125rem] font-medium text-text-secondary">{labelMap[priority]}</span>
    </span>
  );
}

function CaseTypeIcon({ type }: { type: CaseType }) {
  const iconMap: Record<CaseType, React.ReactElement> = {
    "Discharge Upgrade": (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>),
    "Medical Board": (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>),
    "Benefits Appeal": (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>),
    "General Inquiry": (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>),
  };
  return iconMap[type] ?? null;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
      <div className="w-[68px] h-[68px] rounded-full bg-error-bg flex items-center justify-center text-error mb-1">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      </div>
      <p className="font-serif text-[1.0625rem] font-bold text-text-primary">Failed to Load Cases</p>
      <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
      <div className="w-[68px] h-[68px] rounded-full bg-bg flex items-center justify-center text-text-muted mb-1">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
      </div>
      <p className="font-serif text-[1.0625rem] font-bold text-text-primary">No cases yet</p>
      <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">Cases will appear here as clients complete their intake questionnaires and are assigned case files.</p>
    </div>
  );
}
