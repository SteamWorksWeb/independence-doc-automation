/**
 * src/app/admin/clients/page.tsx
 *
 * Client Directory — 4-Step Pipeline View
 *
 * React Server Component that fetches clients and passes them to the
 * ClientFilterTable client component for interactive filtering.
 *
 * Pipeline: Intake Pending → Ready for Review → Approved → Rejected
 */

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import InviteClientModal from "@/components/admin/InviteClientModal";
import ClientTabs from "@/components/admin/ClientTabs";
import ClientFilterTable from "@/components/admin/ClientFilterTable";
import type { ClientRow, ClientStatus } from "@/components/admin/ClientFilterTable";

export const metadata: Metadata = {
  title: "Client Directory",
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

// ── Status derivation (4-step pipeline) ───────────────────────────────────────

function getStatus(client: Client): ClientStatus {
  // Step 1: Unverified / no intake → "Intake Pending"
  if (!client.isVerified) return "Intake Pending";
  if (!client.intakeProfile || !client.intakeProfile.isCompleted) return "Intake Pending";

  // Step 2: Intake complete → "Ready for Review" (default for completed intakes)
  // In Phase 2, the backend will provide explicit status fields.
  // For now, completed intakes are "Ready for Review" by default.
  return "Ready for Review";
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

// ── Secure data fetch ─────────────────────────────────────────────────────────

async function fetchClients(): Promise<{ clients: ClientRow[] | null; error: string | null }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    console.error("[clients] FAIL: No admin_session cookie found in Server Component.");
    return { clients: null, error: "Unauthorized: No active admin session." };
  }

  const masked = token.length > 10
    ? `${token.slice(0, 5)}…${token.slice(-5)}`
    : "****";
  console.log(`[clients] admin_session token present: ${masked} (${token.length} chars)`);

  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error(
      "[clients] FAIL: NEXT_PUBLIC_AWS_API_URL is undefined.",
      "Available env keys:", Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_")).join(", ") || "(none)"
    );
    return { clients: null, error: "Server configuration error. Please check server logs." };
  }

  const targetUrl = `${backendBase}/admin/clients`;
  console.log(`[clients] Fetching directly from backend: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    console.log(`[clients] Backend responded: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(could not read response body)");
      console.error(
        `[clients] FAIL: Backend returned ${res.status}`,
        `| URL: ${targetUrl}`,
        `| Body: ${errorText.slice(0, 500)}`
      );
      return { clients: null, error: "Failed to load clients. Please check server logs." };
    }

    const data = await res.json();
    const raw: Client[] = Array.isArray(data) ? data : (data.clients ?? []);
    const clients: ClientRow[] = raw.map((c) => ({
      ...c,
      status: getStatus(c),
    }));
    console.log(`[clients] SUCCESS: Loaded ${clients.length} clients from backend.`);
    return { clients, error: null };
  } catch (error) {
    console.error("[clients] FETCH EXCEPTION:", error);
    return { clients: null, error: `Network Exception: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function ClientsPage() {
  const headersList = await headers();
  const adminEmail = headersList.get("x-admin-email") ?? "Administrator";

  const cookieStore = await cookies();
  const adminToken = cookieStore.get("admin_session")?.value ?? "";

  const { clients, error } = await fetchClients();

  // Derive counts for the stat strip
  const total = clients?.length ?? 0;
  const intakePending = clients?.filter((c) => c.status === "Intake Pending").length ?? 0;
  const readyForReview = clients?.filter((c) => c.status === "Ready for Review").length ?? 0;
  const approved = clients?.filter((c) => c.status === "Approved").length ?? 0;
  const rejected = clients?.filter((c) => c.status === "Rejected").length ?? 0;

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] animate-fade-in">

      {/* ── Page header ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap max-[640px]:flex-col">
        <div>
          <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy mb-1 leading-[1.1]">
            Client Directory
          </h1>
          <p className="text-sm text-text-muted">
            Signed in as <strong>{adminEmail}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {adminToken && <InviteClientModal adminToken={adminToken} />}
          <div className="font-sans text-[0.8125rem] text-text-muted bg-white border border-border py-1.5 px-3.5 rounded-[20px] whitespace-nowrap self-start max-[640px]:self-stretch max-[640px]:text-center">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* ── Pipeline stat strip ───────────────────────────── */}
      <div className="grid grid-cols-5 gap-3 max-[1024px]:grid-cols-3 max-[640px]:grid-cols-2 max-[640px]:gap-2.5 max-[400px]:grid-cols-1">
        <StatPill label="Total Clients" value={error ? "—" : String(total)} color="navy" />
        <StatPill label="Intake Pending" value={error ? "—" : String(intakePending)} color="warning" />
        <StatPill label="Ready for Review" value={error ? "—" : String(readyForReview)} color="info" />
        <StatPill label="Approved" value={error ? "—" : String(approved)} color="success" />
        <StatPill label="Rejected" value={error ? "—" : String(rejected)} color="muted" />
      </div>

      {/* ── Main table card (tabbed) ─────────────────────── */}
      <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="flex items-start justify-between py-5 px-6 border-b border-border gap-4 flex-wrap max-[640px]:flex-col">
          <div>
            <h2 className="font-serif text-[1.0625rem] font-bold text-navy mb-0.5">
              Client Pipeline
            </h2>
            {!error && (
              <p className="text-[0.8125rem] text-text-muted">
                Filter and manage clients across the 4-step pipeline
              </p>
            )}
          </div>
        </div>

        <ClientTabs adminToken={adminToken} clientCount={total}>
          {/* ── Active Clients tab content ── */}

          {/* Error state */}
          {error && <ErrorState message={error} />}

          {/* Empty state */}
          {!error && clients && clients.length === 0 && <EmptyState />}

          {/* Filterable table (client component) */}
          {!error && clients && clients.length > 0 && (
            <ClientFilterTable clients={clients} />
          )}
        </ClientTabs>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: "navy" | "success" | "warning" | "muted" | "info" }) {
  const borderColorMap: Record<string, string> = {
    navy: "border-l-navy",
    success: "border-l-success",
    warning: "border-l-warning",
    muted: "border-l-border",
    info: "border-l-[#2563eb]",
  };
  const valueColorMap: Record<string, string> = {
    navy: "text-navy",
    success: "text-success",
    warning: "text-warning",
    muted: "text-text-muted",
    info: "text-[#2563eb]",
  };
  return (
    <div className={`bg-white border border-border rounded-lg py-4 px-5 flex flex-col gap-1 shadow-sm transition-[box-shadow,transform] duration-200 ease-in-out hover:shadow-md hover:-translate-y-px border-l-[3px] ${borderColorMap[color]}`}>
      <span className={`font-serif text-[1.875rem] font-black leading-none ${valueColorMap[color]}`}>{value}</span>
      <span className="text-xs font-semibold tracking-[0.05em] uppercase text-text-muted">{label}</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
      <div className="w-[68px] h-[68px] rounded-full bg-error-bg flex items-center justify-center text-error mb-1">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
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
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      </div>
      <p className="font-serif text-[1.0625rem] font-bold text-text-primary">No clients yet</p>
      <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">Client accounts will appear here once they register for the portal.</p>
    </div>
  );
}
