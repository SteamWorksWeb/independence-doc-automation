/**
 * src/app/admin/leads/page.tsx
 *
 * Leads Directory — shows all invited borrowers who have NOT yet been promoted
 * to Client (userType === 'LEAD' on the backend).
 *
 * A Lead is created when a borrower accepts a borrower invite and sets their
 * password via the intake flow. They remain a Lead until a lawyer or admin
 * manually promotes them via "Promote to Client".
 *
 * Auth: React Server Component → reads HttpOnly `admin_session` cookie →
 *       sends as Authorization: Bearer to Render backend.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import InviteBorrowerModal from "@/components/admin/InviteBorrowerModal";
import LeadsTable from "@/components/admin/LeadsTable";

export const metadata: Metadata = {
  title: "Leads | Independence Law",
};

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  status: string;
  intakeStatus: string;
  createdAt: string;
  updatedAt: string;
  assignedToId?: string | null;
  assigneeName?: string | null;
  intakeProfile?: {
    isCompleted: boolean;
    phone?: string | null;
    householdSize?: number | null;
    monthlyIncome?: number | null;
  } | null;
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function fetchLeads(): Promise<{
  leads: Lead[];
  error: string | null;
  adminToken: string;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    return { leads: [], error: "Unauthorized: No active admin session.", adminToken: "" };
  }

  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    return { leads: [], error: "Server configuration error.", adminToken: token };
  }

  const url = `${backendBase.replace(/\/+$/, "")}/admin/leads`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[leads] Backend ${res.status}: ${text.slice(0, 400)}`);
      return { leads: [], error: "Failed to load leads.", adminToken: token };
    }

    const data = await res.json();
    const leads: Lead[] = Array.isArray(data.leads) ? data.leads : [];
    console.log(`[leads] Loaded ${leads.length} lead(s).`);
    return { leads, error: null, adminToken: token };
  } catch (err) {
    console.error("[leads] fetch error:", err);
    return {
      leads: [],
      error: `Network error: ${err instanceof Error ? err.message : "Unknown"}`,
      adminToken: token,
    };
  }
}

// ── Stat pill sub-component ───────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  const borderMap: Record<string, string> = {
    navy:    "border-l-navy",
    warning: "border-l-warning",
    success: "border-l-success",
  };
  const valueMap: Record<string, string> = {
    navy:    "text-navy",
    warning: "text-warning",
    success: "text-success",
  };
  return (
    <div
      className={`bg-white border border-border rounded-lg py-4 px-5 flex flex-col gap-1 shadow-sm border-l-[3px] ${
        borderMap[color] ?? "border-l-navy"
      }`}
    >
      <span
        className={`font-serif text-[1.875rem] font-black leading-none ${
          valueMap[color] ?? "text-navy"
        }`}
      >
        {value}
      </span>
      <span className="text-xs font-semibold tracking-[0.05em] uppercase text-text-muted">
        {label}
      </span>
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function LeadsPage() {
  const { leads, error, adminToken } = await fetchLeads();

  const total      = leads.length;
  const incomplete = leads.filter(
    (l) => l.intakeStatus !== "Complete" && !l.intakeProfile?.isCompleted
  ).length;
  const complete = total - incomplete;

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap max-[640px]:flex-col">
        <div>
          <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy mb-1 leading-[1.1]">
            Leads
          </h1>
          <p className="text-sm text-text-muted">
            Invited borrowers pending promotion to Client
          </p>
        </div>
        <InviteBorrowerModal adminToken={adminToken} />
      </div>

      {/* ── Stat strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
        <StatPill label="Total Leads"   value={error ? "—" : String(total)}     color="navy"    />
        <StatPill label="Incomplete"    value={error ? "—" : String(incomplete)} color="warning" />
        <StatPill label="Form Complete" value={error ? "—" : String(complete)}   color="success" />
      </div>

      {/* ── Leads table ─────────────────────────────────────────────────── */}
      <LeadsTable leads={leads} fetchError={error} adminToken={adminToken} />

    </div>
  );
}
