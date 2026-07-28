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
 * The interactive table (filter tabs, status badges) lives in the client
 * component DashboardClientTable to avoid mixing server-only APIs (cookies)
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import type { DashboardClientRow } from "@/components/admin/DashboardClientTable";

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
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  isVerified: boolean;
  intakeProfile: IntakeProfile | null;
}

type ClientStatus = "Pending Email Verification" | "Intake Pending" | "Ready for Review";
type BadgeTone = "success" | "warning" | "muted" | "danger" | "info";

type DashboardClientSummary = DashboardClientRow & {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
};

interface ApiSnapshot {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  isDischargeable?: boolean | null;
  status?: string | null;
  lowestMonthlyPayment?: number | string | null;
  client?: {
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
}

interface DashboardSnapshot {
  id: string;
  clientName: string;
  clientEmail?: string;
  statusLabel: string;
  statusTone: BadgeTone;
  updatedAt?: string;
  createdAt?: string;
  lowestMonthlyPayment?: string;
}

interface ConversationSummary {
  id: string;
  unreadCount?: number;
  updatedAt?: string;
  createdAt?: string;
  client?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  borrower?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatus(client: Client): ClientStatus {
  if (!client.isVerified) return "Pending Email Verification";
  if (!client.intakeProfile || !client.intakeProfile.isCompleted) return "Intake Pending";
  return "Ready for Review";
}

function getRequestOrigin(headersList: { get(name: string): string | null }): string | null {
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (!host) return null;

  const proto = headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getArrayFromResponse<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (isRecord(data) && Array.isArray(data[key])) return data[key] as T[];
  return [];
}

function getTimeValue(iso?: string): number {
  if (!iso) return 0;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatDate(iso?: string): string {
  if (!iso) return "Unavailable";
  const time = getTimeValue(iso);
  if (!time) return "Unavailable";

  return new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(iso?: string): string {
  if (!iso) return "Unavailable";
  const time = getTimeValue(iso);
  if (!time) return "Unavailable";

  return new Date(time).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sortByNewest<T>(items: T[], getIso: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => getTimeValue(getIso(b)) - getTimeValue(getIso(a)));
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function getClientDisplayName(client: DashboardClientSummary): string {
  const fullName = [client.firstName, client.lastName].filter(Boolean).join(" ").trim();
  return fullName || client.name?.trim() || client.email || "Unknown Client";
}

function getSnapshotClientName(snapshot: ApiSnapshot): string {
  const client = snapshot.client;
  const fullName = [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
  return fullName || client?.name?.trim() || client?.email || "Unknown Borrower";
}

function getConversationBorrowerName(conversation: ConversationSummary): string {
  const person = conversation.client ?? conversation.borrower;
  const fullName = [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
  return fullName || person?.email || "Unknown Borrower";
}

function getSnapshotStatus(snapshot: ApiSnapshot): { label: string; tone: BadgeTone } {
  const normalizedStatus = snapshot.status?.trim().toLowerCase();
  if (normalizedStatus) {
    if (normalizedStatus === "dischargeable") return { label: "Dischargeable", tone: "success" };
    if (normalizedStatus === "not_dischargeable") return { label: "Not Dischargeable", tone: "danger" };
    if (normalizedStatus.includes("incomplete") || normalizedStatus.includes("pending")) {
      return { label: toTitleCase(normalizedStatus), tone: "warning" };
    }
    return { label: toTitleCase(normalizedStatus), tone: "info" };
  }

  if (snapshot.isDischargeable === true) return { label: "Dischargeable", tone: "success" };
  if (snapshot.isDischargeable === false) return { label: "Not Dischargeable", tone: "danger" };
  return { label: "Incomplete", tone: "warning" };
}

function isActiveSnapshot(snapshot: ApiSnapshot): boolean {
  const status = snapshot.status?.trim().toLowerCase();
  if (!status) return true;
  return !["archived", "closed", "complete", "completed", "deleted", "cancelled", "canceled"].includes(status);
}

function formatPayment(value: ApiSnapshot["lowestMonthlyPayment"]): string | undefined {
  if (value == null) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return `$${numeric.toFixed(2)}`;
  return String(value);
}

function mapSnapshot(snapshot: ApiSnapshot): DashboardSnapshot {
  const status = getSnapshotStatus(snapshot);
  return {
    id: snapshot.id,
    clientName: getSnapshotClientName(snapshot),
    clientEmail: snapshot.client?.email ?? undefined,
    statusLabel: status.label,
    statusTone: status.tone,
    updatedAt: snapshot.updatedAt,
    createdAt: snapshot.createdAt,
    lowestMonthlyPayment: formatPayment(snapshot.lowestMonthlyPayment),
  };
}

async function fetchAdminRoute(
  path: string,
  requestOrigin: string | null,
  adminToken: string,
  label: string
): Promise<{ data: unknown | null; error: string | null }> {
  if (!adminToken) return { data: null, error: "Unauthorized: No active admin session." };
  if (!requestOrigin) return { data: null, error: "Unable to resolve the dashboard request origin." };

  const url = new URL(path, requestOrigin).toString();

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: `admin_session=${adminToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(could not read response body)");
      console.error(`[dashboard/${label}] Route returned ${res.status}`, `| URL: ${url}`, `| Body: ${errorText.slice(0, 500)}`);
      return { data: null, error: `Failed to load ${label}.` };
    }

    return { data: await res.json(), error: null };
  } catch (error) {
    console.error(`[dashboard/${label}] FETCH EXCEPTION:`, error);
    return { data: null, error: `Network Exception: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

async function fetchSnapshots(
  requestOrigin: string | null,
  adminToken: string
): Promise<{ snapshots: DashboardSnapshot[]; error: string | null }> {
  const { data, error } = await fetchAdminRoute(
    "/api/admin/discharge-snapshots",
    requestOrigin,
    adminToken,
    "snapshots"
  );
  if (error) return { snapshots: [], error };

  const raw = getArrayFromResponse<ApiSnapshot>(data, "snapshots");
  const snapshots = sortByNewest(raw.filter(isActiveSnapshot), (snapshot) => snapshot.updatedAt ?? snapshot.createdAt)
    .slice(0, 5)
    .map(mapSnapshot);

  return { snapshots, error: null };
}

async function fetchConversations(
  requestOrigin: string | null,
  adminToken: string
): Promise<{ conversations: ConversationSummary[]; error: string | null }> {
  const { data, error } = await fetchAdminRoute(
    "/api/admin/conversations",
    requestOrigin,
    adminToken,
    "conversations"
  );
  if (error) return { conversations: [], error };

  const conversations = sortByNewest(
    getArrayFromResponse<ConversationSummary>(data, "conversations"),
    (conversation) => conversation.updatedAt ?? conversation.createdAt
  ).slice(0, 5);

  return { conversations, error: null };
}

async function fetchClients(): Promise<{ clients: DashboardClientSummary[] | null; error: string | null }> {
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
    const clients: DashboardClientSummary[] = raw.map((c) => ({ ...c, status: getStatus(c) }));
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
  const requestOrigin = getRequestOrigin(headersList);

  const cookieStore = await cookies();
  const adminToken = cookieStore.get("admin_session")?.value ?? "";

  const [
    { clients, error },
    { snapshots, error: snapshotsError },
    { conversations, error: conversationsError },
  ] = await Promise.all([
    fetchClients(),
    fetchSnapshots(requestOrigin, adminToken),
    fetchConversations(requestOrigin, adminToken),
  ]);

  // Derive counts for the stat strip
  const total = clients?.length ?? 0;
  const ready = clients?.filter((c) => c.status === "Ready for Review").length ?? 0;
  const intake = clients?.filter((c) => c.status === "Intake Pending").length ?? 0;
  const unverified = clients?.filter((c) => c.status === "Pending Email Verification").length ?? 0;
  const recentClients = clients
    ? sortByNewest(clients, (client) => client.createdAt).slice(0, 5)
    : [];

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <ActiveSnapshotsWidget snapshots={snapshots} error={snapshotsError} />
          <RecentClientsWidget clients={recentClients} error={error} total={total} />
        </div>

        <MessageCenterWidget conversations={conversations} error={conversationsError} />
      </div>
    </div>
  );
}

// ── Sub-components (Server-safe — no hooks) ───────────────────────────────────

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

const BADGE_TONE_STYLES: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  muted: "bg-bg-alt text-text-muted",
  danger: "bg-error-bg text-error",
  info: "bg-blue-50 text-blue-700",
};

const CLIENT_STATUS_STYLES: Record<ClientStatus, string> = {
  "Pending Email Verification": "bg-bg-alt text-text-muted",
  "Intake Pending": "bg-warning-bg text-warning",
  "Ready for Review": "bg-success-bg text-success",
};

function DashboardWidget({
  title,
  subtitle,
  href,
  linkLabel,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-[1.0625rem] font-bold text-navy mb-0.5">
          {title}
        </h2>
        <p className="text-[0.8125rem] text-text-muted">{subtitle}</p>
      </div>

      <div className="flex-1">{children}</div>

      <Link
        href={href}
        className="inline-flex items-center gap-1 self-start text-[0.8125rem] font-semibold text-crimson no-underline transition-[color] duration-fast hover:text-crimson-hover hover:underline"
      >
        {linkLabel} <span aria-hidden>&rarr;</span>
      </Link>
    </section>
  );
}

function ActiveSnapshotsWidget({
  snapshots,
  error,
}: {
  snapshots: DashboardSnapshot[];
  error: string | null;
}) {
  return (
    <DashboardWidget
      title="Active Snapshots"
      subtitle="Most recently updated discharge assessments"
      href="/admin/discharge-snapshots"
      linkLabel="View Full Pipeline"
    >
      {error ? (
        <InlineErrorState message={error} />
      ) : snapshots.length === 0 ? (
        <CompactEmptyState title="No active snapshots" />
      ) : (
        <ul className="divide-y divide-border" role="list">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">
                    {snapshot.clientName}
                  </p>
                  <p className="text-[0.8125rem] text-text-muted truncate">
                    {snapshot.clientEmail ?? "No email on file"}
                  </p>
                </div>
                <StatusBadge label={snapshot.statusLabel} tone={snapshot.statusTone} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[0.75rem] text-text-muted">
                <span>Updated {formatDate(snapshot.updatedAt ?? snapshot.createdAt)}</span>
                {snapshot.lowestMonthlyPayment && (
                  <span className="font-semibold text-text-secondary">
                    {snapshot.lowestMonthlyPayment}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardWidget>
  );
}

function RecentClientsWidget({
  clients,
  error,
  total,
}: {
  clients: DashboardClientSummary[];
  error: string | null;
  total: number;
}) {
  return (
    <DashboardWidget
      title="Recent Clients"
      subtitle={error ? "Client roster unavailable" : `${total} ${total === 1 ? "client" : "clients"} registered`}
      href="/admin/clients"
      linkLabel="View All Clients"
    >
      {error ? (
        <InlineErrorState message={error} />
      ) : clients.length === 0 ? (
        <CompactEmptyState title="No recent clients" />
      ) : (
        <ul className="divide-y divide-border" role="list">
          {clients.map((client) => (
            <li key={client.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="text-sm font-semibold text-navy truncate block transition-[color] duration-fast hover:text-crimson hover:underline"
                    title={client.email}
                  >
                    {getClientDisplayName(client)}
                  </Link>
                  <p className="text-[0.8125rem] text-text-muted truncate">{client.email}</p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${CLIENT_STATUS_STYLES[client.status]}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80" aria-hidden />
                  {client.status}
                </span>
              </div>
              <p className="mt-2 text-[0.75rem] text-text-muted">
                Joined {formatDate(client.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DashboardWidget>
  );
}

function MessageCenterWidget({
  conversations,
  error,
}: {
  conversations: ConversationSummary[];
  error: string | null;
}) {
  return (
    <DashboardWidget
      title="Message Center"
      subtitle="Recently updated borrower conversations"
      href="/admin/message-center"
      linkLabel="Go to Inbox"
    >
      {error ? (
        <InlineErrorState message={error} />
      ) : conversations.length === 0 ? (
        <CompactEmptyState title="No recent messages" />
      ) : (
        <ul className="divide-y divide-border" role="list">
          {conversations.map((conversation) => {
            const unread = conversation.unreadCount ?? 0;
            return (
              <li key={conversation.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">
                      {getConversationBorrowerName(conversation)}
                    </p>
                    <p className="text-[0.75rem] text-text-muted">
                      {formatTimestamp(conversation.updatedAt ?? conversation.createdAt)}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span
                      className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#dc2626] text-white text-[0.625rem] font-bold leading-none"
                      aria-label={`${unread} unread message${unread !== 1 ? "s" : ""}`}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardWidget>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${BADGE_TONE_STYLES[tone]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80" aria-hidden />
      {label}
    </span>
  );
}

function CompactEmptyState({ title }: { title: string }) {
  return (
    <div className="flex min-h-[10rem] items-center justify-center rounded-lg border border-dashed border-border bg-bg px-4 py-8 text-center">
      <p className="text-sm font-semibold text-text-muted">{title}</p>
    </div>
  );
}

function InlineErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-error-bg bg-error-bg/40 px-4 py-3">
      <p className="text-sm font-semibold text-error">Unable to load this feed</p>
      <p className="mt-1 text-[0.8125rem] text-text-muted">{message}</p>
    </div>
  );
}
