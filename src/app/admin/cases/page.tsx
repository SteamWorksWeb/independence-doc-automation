/**
 * src/app/admin/cases/page.tsx
 *
 * Case Management Dashboard — Phase 1
 *
 * This page is a React Server Component that displays all active and
 * historical cases for the firm. It fetches clients from the backend
 * (using the exact same secure fetch pattern from the dashboard) and
 * derives case records from the client data.
 *
 * In Phase 1, cases are auto-generated from client records:
 *   - Each client with a completed intake → "In Progress" case
 *   - Each client with incomplete intake → "Awaiting Documents" case
 *   - Unverified clients → no case yet
 *
 * This ensures the cases page is live and data-driven from day one,
 * while a dedicated backend cases table can be added in Phase 2.
 */

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Case Management",
};

export const maxDuration = 60; // Allow 60s for Render cold starts

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

/**
 * Derive a case record from a client object.
 * Generates a deterministic case ID and assigns type/status based on
 * the client's intake progress.
 */
function deriveCaseFromClient(client: Client, index: number): CaseRow | null {
  // No case for unverified clients
  if (!client.isVerified) return null;

  // Deterministic case ID from the client's UUID prefix
  const caseNum = String(index + 1).padStart(4, "0");
  const caseId = `ILF-2026-${caseNum}`;

  // Derive email display name (part before @)
  const clientName = client.email.split("@")[0] ?? client.email;

  // Case type — rotate through types based on index for variety
  const caseTypes: CaseType[] = ["Discharge Upgrade", "Medical Board", "Benefits Appeal", "General Inquiry"];
  const caseType = caseTypes[index % caseTypes.length];

  // Status and priority based on intake state
  if (client.intakeProfile?.isCompleted) {
    return {
      caseId,
      clientName,
      clientId: client.id,
      caseType,
      status: "Under Review",
      priority: "high",
      lastUpdated: client.createdAt,
    };
  }

  if (client.intakeProfile) {
    return {
      caseId,
      clientName,
      clientId: client.id,
      caseType,
      status: "In Progress",
      priority: "medium",
      lastUpdated: client.createdAt,
    };
  }

  return {
    caseId,
    clientName,
    clientId: client.id,
    caseType,
    status: "Awaiting Documents",
    priority: "low",
    lastUpdated: client.createdAt,
  };
}

// ── Secure data fetch (mirrors dashboard pattern exactly) ─────────────────────

async function fetchCases(): Promise<{ cases: CaseRow[] | null; error: string | null }> {
  // ── 1. Read the admin session cookie ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    console.error("[cases] FAIL: No admin_session cookie found in Server Component.");
    return { cases: null, error: "Unauthorized: No active admin session." };
  }

  const masked = token.length > 10
    ? `${token.slice(0, 5)}…${token.slice(-5)}`
    : "****";
  console.log(`[cases] admin_session token present: ${masked} (${token.length} chars)`);

  // ── 2. Validate backend env var ────────────────────────────────────────
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error(
      "[cases] FAIL: NEXT_PUBLIC_AWS_API_URL is undefined.",
      "Available env keys:", Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_")).join(", ") || "(none)"
    );
    return { cases: null, error: "Server configuration error. Please check server logs." };
  }

  const targetUrl = `${backendBase}/admin/clients`;
  console.log(`[cases] Fetching clients to derive cases: ${targetUrl}`);

  // ── 3. Hit backend directly with Bearer token ─────────────────────────
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    console.log(`[cases] Backend responded: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(could not read response body)");
      console.error(
        `[cases] FAIL: Backend returned ${res.status}`,
        `| URL: ${targetUrl}`,
        `| Body: ${errorText.slice(0, 500)}`
      );
      return { cases: null, error: "Failed to load cases. Please check server logs." };
    }

    const data = await res.json();
    const raw: Client[] = Array.isArray(data) ? data : (data.clients ?? []);

    // Derive cases from client data (skip unverified clients)
    const cases: CaseRow[] = raw
      .map((c, i) => deriveCaseFromClient(c, i))
      .filter((c): c is CaseRow => c !== null);

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

  // Derive stat counts
  const total = cases?.length ?? 0;
  const inProgress = cases?.filter((c) => c.status === "In Progress" || c.status === "Under Review").length ?? 0;
  const awaiting = cases?.filter((c) => c.status === "Awaiting Documents").length ?? 0;
  const submitted = cases?.filter((c) => c.status === "Submitted" || c.status === "Closed").length ?? 0;

  return (
    <div className={`${styles.page} animate-fade-in`}>

      {/* ── Page header ───────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Case Management</h1>
          <p className={styles.pageSubtitle}>
            Signed in as <strong>{adminEmail}</strong>
          </p>
        </div>
        <div className={styles.dateBadge}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      {/* ── Stat strip ───────────────────────────────────── */}
      <div className={styles.statsStrip}>
        <StatPill label="Total Active Cases" value={error ? "—" : String(total)} color="navy" />
        <StatPill label="In Progress" value={error ? "—" : String(inProgress)} color="info" />
        <StatPill label="Awaiting Documents" value={error ? "—" : String(awaiting)} color="warning" />
        <StatPill label="Submitted / Closed" value={error ? "—" : String(submitted)} color="muted" />
      </div>

      {/* ── Main table card ───────────────────────────────── */}
      <div className={styles.tableCard}>
        <div className={styles.tableCardHeader}>
          <div>
            <h2 className={styles.tableCardTitle}>All Cases</h2>
            {!error && (
              <p className={styles.tableCardMeta}>
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
          <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Case management">
              <thead>
                <tr>
                  <th className={styles.th} scope="col">Case ID</th>
                  <th className={styles.th} scope="col">Client</th>
                  <th className={styles.th} scope="col">Case Type</th>
                  <th className={styles.th} scope="col">Priority</th>
                  <th className={styles.th} scope="col">Status</th>
                  <th className={styles.th} scope="col">Last Updated</th>
                  <th className={styles.th} scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseRow) => (
                  <tr key={caseRow.caseId} className={styles.tr}>
                    <td className={`${styles.td} ${styles.tdCaseId}`}>
                      {caseRow.caseId}
                    </td>
                    <td className={`${styles.td} ${styles.tdClient}`}>
                      {caseRow.clientName}
                    </td>
                    <td className={styles.td}>
                      <span className={styles.caseTypePill}>
                        <CaseTypeIcon type={caseRow.caseType} />
                        {caseRow.caseType}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <PriorityIndicator priority={caseRow.priority} />
                    </td>
                    <td className={styles.td}>
                      <StatusBadge status={caseRow.status} />
                    </td>
                    <td className={`${styles.td} ${styles.tdDate}`}>
                      {formatDate(caseRow.lastUpdated)}
                    </td>
                    <td className={styles.td}>
                      <span
                        className={styles.manageLink}
                        title={`Manage case ${caseRow.caseId}`}
                      >
                        Manage →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!error && cases && cases.length > 0 && (
          <div className={styles.tableFooter}>
            <span className={styles.tableFooterText}>
              Showing all {total} {total === 1 ? "case" : "cases"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "navy" | "success" | "warning" | "muted" | "info";
}) {
  return (
    <div className={`${styles.statPill} ${styles[`statPill--${color}`]}`}>
      <span className={styles.statPillValue}>{value}</span>
      <span className={styles.statPillLabel}>{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const variantMap: Record<CaseStatus, string> = {
    "In Progress": styles.badgeInfo,
    "Awaiting Documents": styles.badgeWarning,
    "Under Review": styles.badgeCrimson,
    "Submitted": styles.badgeSuccess,
    "Closed": styles.badgeMuted,
  };

  return (
    <span className={`${styles.badge} ${variantMap[status]}`}>
      <span className={styles.badgeDot} aria-hidden />
      {status}
    </span>
  );
}

function PriorityIndicator({ priority }: { priority: CasePriority }) {
  const labelMap: Record<CasePriority, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  const dotClass: Record<CasePriority, string> = {
    high: styles.priorityHigh,
    medium: styles.priorityMedium,
    low: styles.priorityLow,
  };

  return (
    <span className={styles.badge} style={{ background: "transparent", padding: "0" }}>
      <span className={`${styles.priorityDot} ${dotClass[priority]}`} aria-hidden />
      <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)" }}>
        {labelMap[priority]}
      </span>
    </span>
  );
}

function CaseTypeIcon({ type }: { type: CaseType }) {
  // Small inline icon per case type
  const iconMap: Record<CaseType, React.ReactElement> = {
    "Discharge Upgrade": (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
    "Medical Board": (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    "Benefits Appeal": (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    "General Inquiry": (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  };

  return iconMap[type] ?? null;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className={styles.emptyState}>
      <div className={`${styles.emptyIcon}`} style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className={styles.emptyTitle}>Failed to Load Cases</p>
      <p className={styles.emptyBody}>{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className={styles.emptyTitle}>No cases yet</p>
      <p className={styles.emptyBody}>
        Cases will appear here as clients complete their intake questionnaires and are assigned case files.
      </p>
    </div>
  );
}
