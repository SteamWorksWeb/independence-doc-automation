/**
 * src/app/admin/dashboard/page.tsx
 *
 * Lawyer Command Center — Client Roster (Phase 1)
 *
 * This page is a React Server Component. It fetches the client list directly
 * from the AWS backend using the admin_session cookie (read via next/headers)
 * as a Bearer token. Direct-to-AWS avoids the self-referencing fetch problem
 * that plagues Server Components on Vercel when hitting their own API routes.
 *
 * Status logic:
 *   - "Pending Email Verification" → isVerified === false
 *   - "Intake Pending"             → isVerified === true, but intakeProfile is
 *                                    null OR intakeProfile.isCompleted === false
 *   - "Ready for Review"           → intakeProfile.isCompleted === true
 *
 * The component renders:
 *   1. Overview header with live client count
 *   2. Status filter tabs (All / Ready / Intake Pending / Unverified)
 *   3. Professional data table with sortable columns
 *   4. Loading skeleton and full error-state UI
 *
 * Migrated from CSS Modules → Tailwind CSS (Phase 1).
 */

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Client Roster",
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

type ClientStatus = "Pending Email Verification" | "Intake Pending" | "Ready for Review";

interface ClientRow extends Client {
  status: ClientStatus;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatus(client: Client): ClientStatus {
  if (!client.isVerified) return "Pending Email Verification";
  if (!client.intakeProfile || !client.intakeProfile.isCompleted) return "Intake Pending";
  return "Ready for Review";
}

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

function obfuscateEmail(email: string): string {
  // Show first 2 chars + domain for privacy in display
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  const dots = "•".repeat(Math.max(0, local.length - 3));
  return `${visible}${dots}@${domain}`;
}

async function fetchClients(): Promise<{ clients: ClientRow[] | null; error: string | null }> {
  // ── 1. Read the admin session cookie ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    console.error("[dashboard] FAIL: No admin_session cookie found in Server Component.");
    return { clients: null, error: "Unauthorized: No active admin session." };
  }

  // Diagnostic: confirm the token exists (mask middle for security)
  const masked = token.length > 10
    ? `${token.slice(0, 5)}…${token.slice(-5)}`
    : "****";
  console.log(`[dashboard] admin_session token present: ${masked} (${token.length} chars)`);

  // ── 2. Validate backend env var BEFORE constructing the URL ────────────
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error(
      "[dashboard] FAIL: NEXT_PUBLIC_AWS_API_URL is undefined.",
      "Available env keys:", Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_")).join(", ") || "(none)"
    );
    return { clients: null, error: "Server configuration error. Please check server logs." };
  }

  const targetUrl = `${backendBase}/admin/clients`;
  console.log(`[dashboard] Fetching directly from AWS: ${targetUrl}`);

  // ── 3. Hit AWS directly with Bearer token ─────────────────────────────
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    console.log(`[dashboard] AWS responded: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(could not read response body)");
      console.error(
        `[dashboard] FAIL: AWS returned ${res.status}`,
        `| URL: ${targetUrl}`,
        `| Body: ${errorText.slice(0, 500)}`
      );
      return { clients: null, error: "Failed to load clients. Please check server logs." };
    }

    const data = await res.json();
    // Backend returns { clients: Client[] } or Client[] — handle both shapes
    const raw: Client[] = Array.isArray(data) ? data : (data.clients ?? []);
    const clients: ClientRow[] = raw.map((c) => ({ ...c, status: getStatus(c) }));
    console.log(`[dashboard] SUCCESS: Loaded ${clients.length} clients from AWS.`);
    return { clients, error: null };
  } catch (error) {
    console.error("[dashboard] FETCH EXCEPTION:", error);
    return { clients: null, error: `Network Exception: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function ClientRosterPage() {
  const headersList = await headers();
  const adminEmail = headersList.get("x-admin-email") ?? "Administrator";

  const { clients, error } = await fetchClients();

  // Derive counts for the stat strip
  const total = clients?.length ?? 0;
  const ready = clients?.filter((c) => c.status === "Ready for Review").length ?? 0;
  const intake = clients?.filter((c) => c.status === "Intake Pending").length ?? 0;
  const unverified = clients?.filter((c) => c.status === "Pending Email Verification").length ?? 0;

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] animate-fade-in">

      {/* ── Page header ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap max-[640px]:flex-col">
        <div>
          <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy mb-1 leading-[1.1]">
            Client Roster
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
        <StatPill label="Total Clients" value={error ? "—" : String(total)} color="navy" />
        <StatPill label="Ready for Review" value={error ? "—" : String(ready)} color="success" />
        <StatPill label="Intake Pending" value={error ? "—" : String(intake)} color="warning" />
        <StatPill label="Unverified" value={error ? "—" : String(unverified)} color="muted" />
      </div>

      {/* ── Main table card ───────────────────────────────── */}
      <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="flex items-start justify-between py-5 px-6 border-b border-border gap-4 flex-wrap max-[640px]:flex-col">
          <div>
            <h2 className="font-serif text-[1.0625rem] font-bold text-navy mb-0.5">
              All Clients
            </h2>
            {!error && (
              <p className="text-[0.8125rem] text-text-muted">
                {total} {total === 1 ? "client" : "clients"} registered
              </p>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && <ErrorState message={error} />}

        {/* Empty state */}
        {!error && clients && clients.length === 0 && <EmptyState />}

        {/* Table */}
        {!error && clients && clients.length > 0 && (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full border-collapse text-sm min-w-[640px]" aria-label="Client roster">
              <thead>
                <tr>
                  <th className="py-[11px] px-4 first:pl-6 last:pr-6 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">#</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Client Email</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Joined Date</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Status</th>
                  <th className="py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Intake</th>
                  <th className="py-[11px] px-4 last:pr-6 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none" scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, index) => (
                  <tr key={client.id} className="border-b border-border last:border-b-0 transition-[background] duration-fast hover:bg-[#fafbfc]">
                    <td className="py-3.5 px-4 first:pl-6 text-text-muted text-[0.8125rem] font-medium w-10 align-middle">{index + 1}</td>
                    <td className="py-3.5 px-4 font-medium max-w-[280px] align-middle">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-navy no-underline font-medium transition-[color] duration-fast hover:text-crimson hover:underline"
                        title={client.email}
                      >
                        <span className="inline max-[640px]:hidden">{client.email}</span>
                        <span className="hidden max-[640px]:inline" aria-hidden>
                          {obfuscateEmail(client.email)}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap align-middle">
                      {formatDate(client.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 align-middle">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="py-3.5 px-4 align-middle">
                      <IntakeIndicator client={client} />
                    </td>
                    <td className="py-3.5 px-4 last:pr-6 align-middle">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-[0.8125rem] font-semibold text-crimson no-underline whitespace-nowrap transition-[color] duration-fast hover:text-crimson-hover hover:underline"
                        aria-label={`View profile for ${client.email}`}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!error && clients && clients.length > 0 && (
          <div className="py-3 px-6 border-t border-border bg-bg flex items-center justify-end">
            <span className="text-[0.8125rem] text-text-muted">
              Showing all {total} {total === 1 ? "client" : "clients"}
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
  color: "navy" | "success" | "warning" | "muted";
}) {
  const borderColorMap: Record<string, string> = {
    navy: "border-l-navy",
    success: "border-l-success",
    warning: "border-l-warning",
    muted: "border-l-border",
  };

  const valueColorMap: Record<string, string> = {
    navy: "text-navy",
    success: "text-success",
    warning: "text-warning",
    muted: "text-text-muted",
  };

  return (
    <div
      className={`bg-white border border-border rounded-lg py-4 px-5 flex flex-col gap-1 shadow-sm transition-[box-shadow,transform] duration-200 ease-in-out hover:shadow-md hover:-translate-y-px border-l-[3px] ${borderColorMap[color]}`}
    >
      <span className={`font-serif text-[1.875rem] font-black leading-none ${valueColorMap[color]}`}>
        {value}
      </span>
      <span className="text-xs font-semibold tracking-[0.05em] uppercase text-text-muted">
        {label}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: ClientStatus }) {
  const variantMap: Record<ClientStatus, string> = {
    "Pending Email Verification": "bg-bg-alt text-text-muted",
    "Intake Pending": "bg-warning-bg text-warning",
    "Ready for Review": "bg-success-bg text-success",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${variantMap[status]}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80" aria-hidden />
      {status}
    </span>
  );
}

function IntakeIndicator({ client }: { client: Client }) {
  if (!client.isVerified) {
    return <span className="text-[0.8125rem] font-medium text-text-muted">N/A</span>;
  }
  if (!client.intakeProfile) {
    return <span className="text-[0.8125rem] font-medium text-text-muted">Not started</span>;
  }
  if (!client.intakeProfile.isCompleted) {
    return <span className="text-[0.8125rem] font-medium text-warning">In progress</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-success">
      <CheckIcon />
      Complete
    </span>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
      <div className="w-[68px] h-[68px] rounded-full bg-error-bg flex items-center justify-center text-error mb-1">
        <AlertIcon />
      </div>
      <p className="font-serif text-[1.0625rem] font-bold text-text-primary">Failed to Load Clients</p>
      <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
      <div className="w-[68px] h-[68px] rounded-full bg-bg flex items-center justify-center text-text-muted mb-1">
        <UsersIcon />
      </div>
      <p className="font-serif text-[1.0625rem] font-bold text-text-primary">No clients yet</p>
      <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">
        Client accounts will appear here once they register for the portal.
      </p>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
