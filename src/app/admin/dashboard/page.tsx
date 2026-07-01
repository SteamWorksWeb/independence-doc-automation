/**
 * src/app/admin/dashboard/page.tsx
 *
 * Lawyer Command Center — Client Roster (Phase 1)
 *
 * This page is a React Server Component. It fetches the client list via the
 * internal Next.js proxy at /api/admin/clients, which reads the admin_session
 * cookie and forwards it as a Bearer token to the AWS backend. The Cookie
 * header is passed explicitly since server-to-server fetches in Next.js do
 * not auto-attach cookies.
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
 */

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Client Roster",
};

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
  // ── 1. Read the admin session cookie — verify it exists ────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    console.warn("[dashboard] No admin_session cookie found.");
    return { clients: null, error: "Unauthorized: No active admin session." };
  }

  // Diagnostic: confirm the token is present (mask middle chars for security)
  const masked = token.length > 10
    ? `${token.slice(0, 5)}…${token.slice(-5)}`
    : "****";
  console.log(`[dashboard] admin_session cookie present: ${masked}`);

  // ── 2. Resolve the internal proxy URL ─────────────────────────────────
  //    Server Components cannot use relative URLs in fetch(), so we need an
  //    absolute URL pointing back to our own Next.js server. The proxy at
  //    /api/admin/clients handles Bearer-token attachment to the backend.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";

  const url = `${appUrl}/api/admin/clients`;
  console.log(`[dashboard] Fetching roster via internal proxy: ${url}`);

  // ── 3. Fetch through the proxy, manually forwarding cookies ───────────
  //    Server-to-server fetches within Next.js do NOT auto-attach cookies;
  //    we must pass them explicitly in the Cookie header.
  const cookieHeader = cookieStore.toString();
  const fetchHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  };
  console.log("[dashboard] Outgoing headers:", {
    "Content-Type": fetchHeaders["Content-Type"],
    Cookie: cookieHeader ? `(${cookieHeader.length} chars)` : "(empty)",
  });

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: fetchHeaders,
      cache: "no-store",
    });

    console.log(`[dashboard] Proxy responded: ${res.status}`);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = (body as { message?: string }).message ?? `Error ${res.status}`;
      console.error(`[dashboard] Proxy error: ${message}`);
      return { clients: null, error: message };
    }

    const data = await res.json();
    // Backend returns { clients: Client[] } or Client[] — handle both shapes
    const raw: Client[] = Array.isArray(data) ? data : (data.clients ?? []);
    const clients: ClientRow[] = raw.map((c) => ({ ...c, status: getStatus(c) }));
    return { clients, error: null };
  } catch (err) {
    console.error("[dashboard] Failed to fetch clients:", err);
    return { clients: null, error: "Unable to connect to the server. Check your connection and try again." };
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
    <div className={`${styles.page} animate-fade-in`}>

      {/* ── Page header ───────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Client Roster</h1>
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
        <StatPill label="Total Clients" value={error ? "—" : String(total)} color="navy" />
        <StatPill label="Ready for Review" value={error ? "—" : String(ready)} color="success" />
        <StatPill label="Intake Pending" value={error ? "—" : String(intake)} color="warning" />
        <StatPill label="Unverified" value={error ? "—" : String(unverified)} color="muted" />
      </div>

      {/* ── Main table card ───────────────────────────────── */}
      <div className={styles.tableCard}>
        <div className={styles.tableCardHeader}>
          <div>
            <h2 className={styles.tableCardTitle}>All Clients</h2>
            {!error && (
              <p className={styles.tableCardMeta}>
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
          <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Client roster">
              <thead>
                <tr>
                  <th className={styles.th} scope="col">#</th>
                  <th className={styles.th} scope="col">Client Email</th>
                  <th className={styles.th} scope="col">Joined Date</th>
                  <th className={styles.th} scope="col">Status</th>
                  <th className={styles.th} scope="col">Intake</th>
                  <th className={styles.th} scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, index) => (
                  <tr key={client.id} className={styles.tr}>
                    <td className={`${styles.td} ${styles.tdIndex}`}>{index + 1}</td>
                    <td className={`${styles.td} ${styles.tdEmail}`}>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className={styles.emailLink}
                        title={client.email}
                      >
                        <span className={styles.emailFull}>{client.email}</span>
                        <span className={styles.emailObfuscated} aria-hidden>
                          {obfuscateEmail(client.email)}
                        </span>
                      </Link>
                    </td>
                    <td className={`${styles.td} ${styles.tdDate}`}>
                      {formatDate(client.createdAt)}
                    </td>
                    <td className={styles.td}>
                      <StatusBadge status={client.status} />
                    </td>
                    <td className={styles.td}>
                      <IntakeIndicator client={client} />
                    </td>
                    <td className={styles.td}>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className={styles.viewLink}
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
          <div className={styles.tableFooter}>
            <span className={styles.tableFooterText}>
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
  return (
    <div className={`${styles.statPill} ${styles[`statPill--${color}`]}`}>
      <span className={styles.statPillValue}>{value}</span>
      <span className={styles.statPillLabel}>{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: ClientStatus }) {
  const variantMap: Record<ClientStatus, string> = {
    "Pending Email Verification": styles.badgeMuted,
    "Intake Pending": styles.badgeWarning,
    "Ready for Review": styles.badgeSuccess,
  };

  return (
    <span className={`${styles.badge} ${variantMap[status]}`}>
      <span className={styles.badgeDot} aria-hidden />
      {status}
    </span>
  );
}

function IntakeIndicator({ client }: { client: Client }) {
  if (!client.isVerified) {
    return <span className={styles.intakeNa}>N/A</span>;
  }
  if (!client.intakeProfile) {
    return <span className={styles.intakeNotStarted}>Not started</span>;
  }
  if (!client.intakeProfile.isCompleted) {
    return <span className={styles.intakeInProgress}>In progress</span>;
  }
  return (
    <span className={styles.intakeComplete}>
      <CheckIcon />
      Complete
    </span>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className={styles.emptyState}>
      <div className={`${styles.emptyIcon} ${styles.emptyIconError}`}>
        <AlertIcon />
      </div>
      <p className={styles.emptyTitle}>Failed to Load Clients</p>
      <p className={styles.emptyBody}>{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <UsersIcon />
      </div>
      <p className={styles.emptyTitle}>No clients yet</p>
      <p className={styles.emptyBody}>
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
