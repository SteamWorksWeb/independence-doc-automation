/**
 * src/app/admin/clients/[id]/page.tsx
 *
 * Client 360° Profile — Server Component
 *
 * Fetches the client's full record (including DOJ intakeProfile) from the
 * Next.js proxy route at /api/admin/clients/[id], which in turn attaches
 * the admin_session cookie and forwards the request to the Render backend.
 *
 * Renders:
 *   1. Breadcrumb back to the roster
 *   2. Client identity card (avatar, email, joined date, status badge)
 *   3. <ClientProfileTabs /> — the 4-tab Client Component for interactive display
 *
 * This layout inherits the dashboard shell (sidebar + topbar) from
 * src/app/admin/dashboard/layout.tsx because it nests inside that route group.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import ClientProfileTabs, {
  type ClientData,
} from "@/components/admin/ClientProfileTabs";
import styles from "@/components/admin/ClientProfile.module.css";

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Client Profile",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchClient(
  id: string
): Promise<{ client: ClientData | null; error: string | null }> {
  // Absolute URL required for server-side fetch inside a React Server Component
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const url = `${protocol}://${host}/api/admin/clients/${id}`;

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (res.status === 404) {
      return { client: null, error: "Client not found. They may have been removed." };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message =
        (body as { message?: string }).message ?? `Server error (${res.status})`;
      return { client: null, error: message };
    }

    const data = await res.json();
    // Backend returns { client: ClientData }
    const client: ClientData = data.client ?? data;
    return { client, error: null };
  } catch (err) {
    console.error("[client-profile] Failed to fetch client:", err);
    return {
      client: null,
      error: "Unable to connect to the server. Please try again.",
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(email: string): string {
  return email.charAt(0).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

type StatusLabel =
  | "Pending Email Verification"
  | "Intake Pending"
  | "Ready for Review";

function getStatus(client: ClientData): StatusLabel {
  if (!client.isVerified) return "Pending Email Verification";
  if (!client.intakeProfile || !client.intakeProfile.isCompleted)
    return "Intake Pending";
  return "Ready for Review";
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function ClientProfilePage({ params }: PageProps) {
  const { id } = await params;
  const { client, error } = await fetchClient(id);

  // ── Error / not-found state ──────────────────────────────────────────────
  if (error || !client) {
    return (
      <div className={`${styles.page} animate-fade-in`}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/admin/dashboard" className={styles.breadcrumbLink}>
            Dashboard
          </Link>
          <span className={styles.breadcrumbSep} aria-hidden>›</span>
          <span className={styles.breadcrumbCurrent}>Client Profile</span>
        </nav>

        <div className={styles.errorCard} role="alert">
          <p className={styles.errorTitle}>Failed to Load Profile</p>
          <p className={styles.errorBody}>{error ?? "An unexpected error occurred."}</p>
        </div>

        <Link href="/admin/dashboard" className={styles.backLink}>
          <BackArrow /> Back to Client Roster
        </Link>
      </div>
    );
  }

  const status = getStatus(client);
  const badgeClass =
    status === "Ready for Review"
      ? styles.badgeSuccess
      : status === "Intake Pending"
      ? styles.badgeWarning
      : styles.badgeMuted;

  // ── Success state ────────────────────────────────────────────────────────
  return (
    <div className={`${styles.page} animate-fade-in`}>

      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin/dashboard" className={styles.breadcrumbLink}>
          Dashboard
        </Link>
        <span className={styles.breadcrumbSep} aria-hidden>›</span>
        <span
          className={styles.breadcrumbCurrent}
          title={client.email}
        >
          {client.email}
        </span>
      </nav>

      {/* ── Client identity card ─────────────────────────────── */}
      <div className={styles.profileCard}>
        <div className={styles.profileLeft}>
          <div className={styles.avatar} aria-hidden>
            {getInitials(client.email)}
          </div>
          <div className={styles.profileMeta}>
            <p className={styles.profileEmail}>{client.email}</p>
            <div className={styles.profileDetails}>
              <span className={styles.profileDetail}>
                <CalendarIcon />
                Joined {formatDate(client.createdAt)}
              </span>
              {client.intakeProfile && (
                <span className={styles.profileDetail}>
                  <CheckIcon />
                  Intake {client.intakeProfile.isCompleted ? "complete" : "in progress"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.profileRight}>
          <span className={`${styles.badge} ${badgeClass}`}>
            <span className={styles.badgeDot} aria-hidden />
            {status}
          </span>
        </div>
      </div>

      {/* ── Tabbed profile ───────────────────────────────────── */}
      <ClientProfileTabs client={client} />

    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
