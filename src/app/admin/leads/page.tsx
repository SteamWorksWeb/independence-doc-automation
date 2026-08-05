/**
 * src/app/admin/leads/page.tsx
 *
 * "View Existing" page for the Leads tool.
 * Route: /admin/leads
 *
 * Auth pattern:
 *   React Server Component reads the HttpOnly admin_session cookie and calls
 *   the local Next.js proxy so browser-side code never needs the admin token.
 *
 * Interactive UI is delegated to DischargeSnapshotsTable, which owns the
 * status filters, Manage button, and action modals.
 */

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import DischargeSnapshotsTable from "@/components/admin/DischargeSnapshotsTable";
import { isDischargeVerdictStatus, type DischargeVerdictStatus } from "@/lib/dischargeVerdict";
import type { SnapshotBorrower } from "@/types/snapshot";
import InviteBorrowerModal from "@/components/admin/InviteBorrowerModal";

export const metadata: Metadata = {
  title: "Leads",
};

export const maxDuration = 60;

interface ApiSnapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  isDischargeable?: boolean | null;
  status?: string;
  lowestMonthlyPayment?: number | string | null;
  pipelineStatus?: string | null;
  client?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    intakeProfile?: {
      firstName?: string | null;
      lastName?: string | null;
      fullName?: string | null;
      name?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  createdByUser?: { firstName?: string; lastName?: string; name?: string } | null;
  updatedByUser?: { firstName?: string; lastName?: string; name?: string } | null;
}

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

function formatTimestamp(iso: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return (
      d
        .toLocaleString("en-US", {
          timeZone: "America/New_York",
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
        .replace(",", "") + " (ET)"
    );
  } catch {
    return iso;
  }
}

function resolveUserName(
  userObj?: { firstName?: string; lastName?: string; name?: string } | null
): string {
  if (!userObj) return "-";
  if (userObj.firstName || userObj.lastName) {
    return [userObj.firstName, userObj.lastName].filter(Boolean).join(" ");
  }
  return userObj.name ?? "-";
}

function splitName(name?: string | null): { firstName?: string; lastName?: string } {
  const trimmed = name?.trim();
  if (!trimmed) return {};

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function resolveDischargeVerdictStatus(snap: ApiSnapshot): DischargeVerdictStatus {
  if (isDischargeVerdictStatus(snap.status)) {
    return snap.status;
  }

  if (snap.isDischargeable === true || snap.status === "dischargeable") {
    return "HIGH_PROBABILITY";
  }
  if (snap.isDischargeable === false || snap.status === "not_dischargeable") {
    return "LOW_PROBABILITY";
  }
  return "PENDING";
}

function mapSnapshot(snap: ApiSnapshot): SnapshotBorrower {
  const status = resolveDischargeVerdictStatus(snap);

  let lowestMonthlyPayment: string | undefined;
  if (snap.lowestMonthlyPayment != null) {
    const raw = Number(snap.lowestMonthlyPayment);
    lowestMonthlyPayment = Number.isFinite(raw)
      ? `$${raw.toFixed(2)}`
      : String(snap.lowestMonthlyPayment);
  }

  const intakeName = splitName(
    snap.client?.intakeProfile?.fullName ??
      snap.client?.intakeProfile?.name ??
      snap.client?.name
  );

  const firstName =
    snap.client?.intakeProfile?.firstName?.trim() ||
    snap.client?.firstName?.trim() ||
    intakeName.firstName ||
    "Unknown";

  const lastName =
    snap.client?.intakeProfile?.lastName?.trim() ||
    snap.client?.lastName?.trim() ||
    intakeName.lastName ||
    "Lead";

  return {
    id: snap.id,
    firstName,
    lastName,
    created: formatTimestamp(snap.createdAt),
    createdBy: resolveUserName(snap.createdByUser),
    lastUpdated: formatTimestamp(snap.updatedAt),
    lastUpdatedBy: resolveUserName(snap.updatedByUser),
    status,
    lowestMonthlyPayment,
    pipelineStatus: snap.pipelineStatus ?? undefined,
    client: snap.client
      ? {
          id: snap.client.id ?? undefined,
          email: snap.client.email ?? undefined,
          phone: snap.client.intakeProfile?.phone ?? snap.client.phone ?? undefined,
        }
      : undefined,
  };
}

async function getInternalApiUrl(path: string): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("host");

  if (!host) {
    throw new Error("Missing host header.");
  }

  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${path}`;
}

async function fetchSnapshots(): Promise<{
  borrowers: SnapshotBorrower[];
  error: string | null;
  adminToken: string;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    console.error("[leads] FAIL: No admin_session cookie found in Server Component.");
    return { borrowers: [], error: "Unauthorized: No active admin session.", adminToken: "" };
  }

  const targetUrl = await getInternalApiUrl("/api/admin/leads");
  console.log(`[leads] Fetching through Next proxy: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Cookie: `admin_session=${token}`,
      },
      cache: "no-store",
    });

    console.log(`[leads] Backend responded: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(could not read response body)");
      console.error(
        `[leads] FAIL: Backend returned ${res.status}`,
        `| URL: ${targetUrl}`,
        `| Body: ${errorText.slice(0, 500)}`
      );
      return { borrowers: [], error: "Failed to load leads.", adminToken: token };
    }

    const data = await res.json();
    const raw: ApiSnapshot[] = Array.isArray(data)
      ? data
      : Array.isArray(data.snapshots)
      ? data.snapshots
      : [];

    console.log(`[leads] SUCCESS: Loaded ${raw.length} snapshots from backend.`);
    return { borrowers: raw.map(mapSnapshot), error: null, adminToken: token };
  } catch (err) {
    console.error("[leads] FETCH EXCEPTION:", err);
    return {
      borrowers: [],
      error: `Network error: ${err instanceof Error ? err.message : "Unknown error"}`,
      adminToken: token,
    };
  }
}

export default async function DischargeSnapshotsPage() {
  const { borrowers, error, adminToken } = await fetchSnapshots();

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap max-[640px]:flex-col">
        <div>
          <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy mb-1 leading-[1.1]">
            Leads
          </h1>
          <p className="text-sm text-text-muted">
            Manage lead discharge eligibility assessments
          </p>
        </div>
        <InviteBorrowerModal adminToken={adminToken} />
      </div>

      <DischargeSnapshotsTable
        initialBorrowers={borrowers}
        fetchError={error}
        adminToken={adminToken}
      />
    </div>
  );
}
