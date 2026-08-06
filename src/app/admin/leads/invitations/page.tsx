/**
 * src/app/admin/leads/invitations/page.tsx
 *
 * Invite Management Page — /admin/leads/invitations
 *
 * Displays all pending/expired client invitations with the ability to:
 *   - Copy the invite link
 *   - Resend the invite email (generates a fresh token)
 *   - Revoke / cancel the invite
 *
 * Auth pattern: reads `admin_session` HttpOnly cookie → passes as Bearer
 * token to PendingInvitesTable, which calls the backend directly.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PendingInvitesTable from "@/components/admin/PendingInvitesTable";
import InviteClientModal from "@/components/admin/InviteClientModal";

export const metadata: Metadata = {
  title: "Invite Management | Liberty Admin",
};

export const dynamic = "force-dynamic";

export default async function InviteManagementPage() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("admin_session")?.value ?? "";

  if (!adminToken) {
    redirect("/admin/login");
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">

        {/* ── Page header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-1">
              Leads
            </p>
            <h1 className="font-serif text-[clamp(1.5rem,3vw,2rem)] text-navy leading-tight mb-1">
              Invite Management
            </h1>
            <p className="text-[0.9375rem] text-text-muted">
              View, resend, or revoke pending client invitations.
            </p>
          </div>

          {/* Send a new invite without leaving the page */}
          <InviteClientModal adminToken={adminToken} />
        </div>

        {/* ── Stats strip ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-8 max-[540px]:grid-cols-1">
          <StatCard
            label="Invite Validity"
            value="7 days"
            note="Each link expires after 7 days"
            color="navy"
          />
          <StatCard
            label="Resend"
            value="Resets timer"
            note="New token, fresh 7-day window"
            color="crimson"
          />
          <StatCard
            label="Revoke"
            value="Instant"
            note="Link becomes unusable immediately"
            color="neutral"
          />
        </div>

        {/* ── Invitations table ────────────────────────────────────── */}
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-serif text-[1.0625rem] text-navy font-bold">
              Pending Invitations
            </h2>
            <span className="text-[0.8125rem] text-text-muted">
              Active &amp; expired (not yet accepted)
            </span>
          </div>
          <PendingInvitesTable adminToken={adminToken} />
        </div>

      </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color: "navy" | "crimson" | "neutral";
}) {
  const accent =
    color === "navy"
      ? "border-t-navy text-navy"
      : color === "crimson"
      ? "border-t-crimson text-crimson"
      : "border-t-border text-text-muted";

  return (
    <div
      className={`bg-white border border-border border-t-2 ${accent} rounded-xl p-4 shadow-sm`}
    >
      <p className="font-sans text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-text-muted mb-1">
        {label}
      </p>
      <p className={`font-serif text-xl font-bold ${accent.split(" ")[1]} mb-0.5`}>
        {value}
      </p>
      <p className="text-[0.8125rem] text-text-muted leading-snug">{note}</p>
    </div>
  );
}
