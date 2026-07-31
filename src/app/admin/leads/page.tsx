/**
 * src/app/admin/leads/page.tsx
 *
 * "View Existing" page for the Leads tool.
 * Route: /admin/leads
 *
 * Auth pattern (matches admin dashboard & client roster):
 *   React Server Component → reads HttpOnly `admin_session` cookie via
 *   next/headers → passes it as `Authorization: Bearer <token>` directly
 *   to the Render backend. No client-side fetch, no CORS issues, no
 *   cookie-forwarding headaches.
 *
 * Interactive UI (search, modal) is delegated to the client component
 * DischargeSnapshotsTable, which receives the pre-fetched data as props.
 */

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import DischargeSnapshotsTable from "@/components/admin/DischargeSnapshotsTable";
import type { SnapshotBorrower } from "@/components/admin/EditSnapshotModal";
import InviteBorrowerModal from "@/components/admin/InviteBorrowerModal";

export const metadata: Metadata = {
  title: "Leads",
};

export const maxDuration = 60; // Allow 60s for Render cold starts

// ── API response shape ────────────────────────────────────────────────────────

interface ApiSnapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  isDischargeable: boolean | null;
  status?: string;
  lowestMonthlyPayment?: number | string | null;
  /**
   * Prisma `include: { client: true }` returns the full Client record.
   * The Client model stores first/last as separate fields.
   * All fields are optional here to guard against any partial responses.
   */
  client?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    /** Legacy / fallback: some older records may have a combined name field */
    name?: string | null;
    email?: string | null;
    /**
     * Phone on the Client model itself — present if the backend stores it there.
     * Many backends store phone on IntakeProfile instead; see intakeProfile below.
     */
    phone?: string | null;
    /**
     * Prisma `include: { client: { include: { intakeProfile: true } } }` will
     * embed this nested object. Phone is authoritative here for the discharge
     * snapshot flow because the wizard persists it to IntakeProfile.
     */
    intakeProfile?: {
      phone?: string | null;
    } | null;
  } | null;
  /** Optional: if the backend embeds admin user info for audit trail */
  createdByUser?: { firstName?: string; lastName?: string; name?: string } | null;
  updatedByUser?: { firstName?: string; lastName?: string; name?: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format an ISO timestamp → "MM-DD-YYYY HH:MM:SS AM/PM (ET)" */
function formatTimestamp(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).replace(",", "") + " (ET)";
  } catch {
    return iso;
  }
}

/** Resolve the user display name from an embedded user object */
function resolveUserName(
  userObj?: { firstName?: string; lastName?: string; name?: string } | null
): string {
  if (!userObj) return "—";
  if (userObj.firstName || userObj.lastName) {
    return [userObj.firstName, userObj.lastName].filter(Boolean).join(" ");
  }
  return userObj.name ?? "—";
}

/** Map a raw API snapshot to the SnapshotBorrower shape the UI/modal expect */
function mapSnapshot(snap: ApiSnapshot): SnapshotBorrower {
  let dischargeable: SnapshotBorrower["dischargeable"] = "Incomplete";
  if (snap.isDischargeable === true || snap.status === "dischargeable") {
    dischargeable = "Yes";
  } else if (snap.isDischargeable === false || snap.status === "not_dischargeable") {
    dischargeable = "No";
  }

  let lowestMonthlyPayment: string | undefined;
  if (snap.lowestMonthlyPayment != null) {
    const raw = Number(snap.lowestMonthlyPayment);
    if (!isNaN(raw)) {
      lowestMonthlyPayment = `$${raw.toFixed(2)}`;
    } else {
      lowestMonthlyPayment = String(snap.lowestMonthlyPayment);
    }
  }

  // Prisma returns `client.firstName` and `client.lastName` as separate fields
  // when using `include: { client: true }`. Read those directly and fall back
  // gracefully so the table never renders a bare comma.
  const clientFirstName =
    snap.client?.firstName?.trim() ||
    // Legacy fallback: split a combined `name` field if present
    snap.client?.name?.trim().split(' ')[0] ||
    'Unknown';
  const clientLastName =
    snap.client?.lastName?.trim() ||
    // Legacy fallback: take everything after the first space
    snap.client?.name?.trim().split(' ').slice(1).join(' ') ||
    'Lead';

  return {
    id: snap.id,
    firstName: clientFirstName,
    lastName: clientLastName,
    created: formatTimestamp(snap.createdAt),
    createdBy: resolveUserName(snap.createdByUser),
    lastUpdated: formatTimestamp(snap.updatedAt),
    lastUpdatedBy: resolveUserName(snap.updatedByUser),
    dischargeable,
    lowestMonthlyPayment,
    client: snap.client
      ? {
          id: snap.client.id ?? undefined,
          email: snap.client.email ?? undefined,
          // Phone lives on IntakeProfile in the discharge-snapshot flow.
          // Fall back to client.phone for any backend that stores it there directly.
          phone:
            snap.client.intakeProfile?.phone ??
            snap.client.phone ??
            undefined,
        }
      : undefined,
  };
}

// ── Secure data fetch (Server-side — token never exposed to browser) ───────────

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
  // ── 1. Read the admin session cookie ────────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    console.error("[leads] FAIL: No admin_session cookie found in Server Component.");
    return { borrowers: [], error: "Unauthorized: No active admin session.", adminToken: "" };
  }

  const masked = token.length > 10
    ? `${token.slice(0, 5)}…${token.slice(-5)}`
    : "****";
  console.log(`[leads] admin_session token present: ${masked} (${token.length} chars)`);

  // ── 2. Validate backend env var ─────────────────────────────────────────
  const targetUrl = await getInternalApiUrl("/api/admin/leads");
  console.log(`[leads] Fetching through Next proxy: ${targetUrl}`);

  // ── 3. Fetch with Bearer token (no cross-origin CORS concerns) ──────────
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
      return { borrowers: [], error: `Failed to load leads.`, adminToken: token };
    }

    const data = await res.json();
    // Support both { snapshots: [...] } and a bare array
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

// ── Page component ────────────────────────────────────────────────────────────

export default async function DischargeSnapshotsPage() {
  const { borrowers, error, adminToken } = await fetchSnapshots();

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] animate-fade-in">

      {/* ── Page header ───────────────────────────────────────────────── */}
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

      {/* ── Stat cards + filter table (Client Component) ─────────────── */}
      <DischargeSnapshotsTable
        initialBorrowers={borrowers}
        fetchError={error}
        adminToken={adminToken}
      />

    </div>
  );
}
