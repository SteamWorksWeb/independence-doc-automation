/**
 * src/app/admin/discharge-snapshots/page.tsx
 *
 * "View Existing" page for the Discharge SnapShot tool.
 * Route: /admin/discharge-snapshots
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
import { cookies } from "next/headers";
import DischargeSnapshotsTable from "@/components/admin/DischargeSnapshotsTable";
import type { SnapshotBorrower } from "@/components/admin/EditSnapshotModal";

export const metadata: Metadata = {
  title: "Discharge Snapshots",
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
    firstName?: string | null;
    lastName?: string | null;
    /** Legacy / fallback: some older records may have a combined name field */
    name?: string | null;
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
    'Borrower';

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
  };
}

// ── Secure data fetch (Server-side — token never exposed to browser) ───────────

async function fetchSnapshots(): Promise<{
  borrowers: SnapshotBorrower[];
  error: string | null;
}> {
  // ── 1. Read the admin session cookie ────────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    console.error("[discharge-snapshots] FAIL: No admin_session cookie found in Server Component.");
    return { borrowers: [], error: "Unauthorized: No active admin session." };
  }

  const masked = token.length > 10
    ? `${token.slice(0, 5)}…${token.slice(-5)}`
    : "****";
  console.log(`[discharge-snapshots] admin_session token present: ${masked} (${token.length} chars)`);

  // ── 2. Validate backend env var ─────────────────────────────────────────
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error(
      "[discharge-snapshots] FAIL: NEXT_PUBLIC_AWS_API_URL is undefined.",
      "Available env keys:", Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_")).join(", ") || "(none)"
    );
    return { borrowers: [], error: "Server configuration error. Please check server logs." };
  }

  const targetUrl = `${backendBase}/admin/discharge-snapshots`;
  console.log(`[discharge-snapshots] Fetching from backend: ${targetUrl}`);

  // ── 3. Fetch with Bearer token (no cross-origin CORS concerns) ──────────
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    console.log(`[discharge-snapshots] Backend responded: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(could not read response body)");
      console.error(
        `[discharge-snapshots] FAIL: Backend returned ${res.status}`,
        `| URL: ${targetUrl}`,
        `| Body: ${errorText.slice(0, 500)}`
      );
      return { borrowers: [], error: `Failed to load snapshots (${res.status}). Please check server logs.` };
    }

    const data = await res.json();
    // Support both { snapshots: [...] } and a bare array
    const raw: ApiSnapshot[] = Array.isArray(data)
      ? data
      : Array.isArray(data.snapshots)
      ? data.snapshots
      : [];

    console.log(`[discharge-snapshots] SUCCESS: Loaded ${raw.length} snapshots from backend.`);
    return { borrowers: raw.map(mapSnapshot), error: null };
  } catch (err) {
    console.error("[discharge-snapshots] FETCH EXCEPTION:", err);
    return {
      borrowers: [],
      error: `Network error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function DischargeSnapshotsPage() {
  const { borrowers, error } = await fetchSnapshots();

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] animate-fade-in">

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap max-[640px]:flex-col">
        <div>
          <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy mb-1 leading-[1.1]">
            Discharge Snapshots
          </h1>
          <p className="text-sm text-text-muted">
            Manage borrower discharge eligibility assessments
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

      {/* ── Stat cards + filter table (Client Component) ─────────────── */}
      <DischargeSnapshotsTable
        initialBorrowers={borrowers}
        fetchError={error}
      />

    </div>
  );
}
