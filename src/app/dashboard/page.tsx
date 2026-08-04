/**
 * src/app/dashboard/page.tsx
 *
 * Client Dashboard — Conditional Rendering Gateway
 *
 * Redesigned to mirror the Admin dashboard architecture:
 *   - 3 top metric cards (Case Status, Action Required, Messages)
 *   - Two-column grid:
 *       Left  → Case Progress timeline + Recent Documents
 *       Right → Message Center widget
 *
 * State A: Intake not complete → IntakeWizard
 * State B: Intake complete     → New dashboard grid
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Link from "next/link";
import IntakeWizard from "@/components/intake/IntakeWizard";

export const metadata: Metadata = {
  title: "My Dashboard",
};

export const maxDuration = 60;

const BORROWER_SESSION_COOKIE_NAMES = ["borrower_session", "client_token"] as const;
const BORROWER_EMAIL_COOKIE_NAME = "borrower_email";

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntakeProfile {
  isCompleted: boolean;
  [key: string]: unknown;
}

interface ClientDocument {
  id: string;
  fileName: string;
  fileSize?: number;
  createdAt?: string;
  status?: string;
}

interface Message {
  id: string;
  content?: string;
  isRead?: boolean;
  createdAt?: string;
  updatedAt?: string;
  sender?: { role?: string };
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
}

function extractBorrowerEmail(value: unknown): string {
  if (!isRecord(value)) return "";

  for (const key of ["email", "borrowerEmail", "clientEmail", "emailAddress", "preferred_username", "username", "sub"]) {
    const email = normalizeEmail(value[key]);
    if (email) return email;
  }

  for (const key of ["borrower", "client", "user", "session", "intakeProfile"]) {
    const nested = value[key];
    if (isRecord(nested)) {
      const email = extractBorrowerEmail(nested);
      if (email) return email;
    }
  }

  return "";
}

async function getBorrowerEmailFromSession(token: string): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return "";

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
      { algorithms: ["HS256"] }
    );
    return extractBorrowerEmail(payload);
  } catch {
    return "";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "—";
  return new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchIntakeStatus(): Promise<{
  profile: IntakeProfile | null;
  error: string | null;
  borrowerEmail: string;
  token: string;
}> {
  const cookieStore = await cookies();
  const cookieEmail = normalizeEmail(cookieStore.get(BORROWER_EMAIL_COOKIE_NAME)?.value);
  const token = BORROWER_SESSION_COOKIE_NAMES
    .map((cookieName) => cookieStore.get(cookieName)?.value)
    .find((value): value is string => !!value);

  if (!token) {
    console.error("[dashboard] No borrower session cookie found.");
    return { profile: null, error: "Unauthorized: No active session.", borrowerEmail: cookieEmail, token: "" };
  }

  const sessionEmail = cookieEmail || await getBorrowerEmailFromSession(token);

  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error("[dashboard] NEXT_PUBLIC_AWS_API_URL is undefined.");
    return { profile: null, error: "Server configuration error.", borrowerEmail: sessionEmail, token };
  }

  const targetUrl = `${backendBase}/intake`;
  console.log(`[dashboard] Fetching intake profile: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    console.log(`[dashboard] Backend responded: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(unreadable)");
      console.error(`[dashboard] Backend returned ${res.status}: ${errorText.slice(0, 300)}`);
      return { profile: null, error: "Failed to load profile. Please try again.", borrowerEmail: sessionEmail, token };
    }

    const data = await res.json();
    const profile: IntakeProfile | null = data.intakeProfile ?? null;
    const borrowerEmail = extractBorrowerEmail(data) || sessionEmail;
    console.log(`[dashboard] Intake profile loaded. isCompleted: ${profile?.isCompleted ?? "null"}`);
    return { profile, error: null, borrowerEmail, token };
  } catch (err) {
    console.error("[dashboard] FETCH EXCEPTION:", err);
    return {
      profile: null,
      error: `Network error: ${err instanceof Error ? err.message : "Unknown"}`,
      borrowerEmail: sessionEmail,
      token,
    };
  }
}

async function fetchDocuments(token: string): Promise<ClientDocument[]> {
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase || !token) return [];

  try {
    const res = await fetch(`${backendBase}/borrower/documents`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: unknown[] = Array.isArray(data) ? data : (data.documents ?? []);
    return raw.slice(0, 4) as ClientDocument[];
  } catch {
    return [];
  }
}

async function fetchMessages(token: string): Promise<Message[]> {
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase || !token) return [];

  try {
    const res = await fetch(`${backendBase}/borrower/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: unknown[] = Array.isArray(data) ? data : (data.messages ?? []);
    return raw.slice(0, 5) as Message[];
  } catch {
    return [];
  }
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { profile, error, borrowerEmail, token } = await fetchIntakeStatus();

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
          <div className="w-[68px] h-[68px] rounded-full bg-error-bg text-error flex items-center justify-center mb-1">
            <AlertIcon />
          </div>
          <p className="font-serif text-[1.0625rem] font-bold text-text-primary">Unable to Load Dashboard</p>
          <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // ── State A: Intake not complete → show the wizard ──────────────────────────
  if (!profile || !profile.isCompleted) {
    return <IntakeWizard initialEmail={borrowerEmail} />;
  }

  // ── State B: Intake complete → fetch supplemental data in parallel ──────────
  const [documents, messages] = await Promise.all([
    fetchDocuments(token),
    fetchMessages(token),
  ]);

  const unreadCount = messages.filter((m) => !m.isRead && m.sender?.role !== "borrower").length;
  const docsNeeded = 0; // TODO: derive from case status when backend supports it

  // ── State B: Render full dashboard ──────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-[1200px] animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap max-[640px]:flex-col">
        <div>
          <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy mb-1 leading-[1.1]">
            Welcome Back
          </h1>
          <p className="text-sm text-text-muted">
            Here&apos;s an overview of your case and activity.
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

      {/* ── Top metric cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 max-[768px]:grid-cols-1 max-[768px]:gap-2.5">
        <MetricCard
          label="Case Status"
          value="In Progress"
          tone="info"
          icon={<FileSearchIcon />}
        />
        <MetricCard
          label="Action Required"
          value={docsNeeded === 0 ? "No Action Needed" : `${docsNeeded} Doc${docsNeeded !== 1 ? "s" : ""} Needed`}
          tone={docsNeeded > 0 ? "warning" : "muted"}
          icon={<DocumentIcon />}
        />
        <MetricCard
          label="Messages"
          value={unreadCount === 0 ? "All Caught Up" : `${unreadCount} Unread`}
          tone={unreadCount > 0 ? "danger" : "success"}
          icon={<MessageIcon />}
        />
      </div>

      {/* ── Two-column grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Case Progress panel */}
          <ClientWidget
            title="Case Progress"
            subtitle="Your journey through the student loan discharge process"
            href="/dashboard"
            linkLabel="View Case Details"
          >
            <CaseProgressTimeline />
          </ClientWidget>

          {/* Recent Documents panel */}
          <ClientWidget
            title="Recent Documents"
            subtitle={documents.length === 0 ? "No documents uploaded yet" : `${documents.length} file${documents.length !== 1 ? "s" : ""} on record`}
            href="/dashboard/documents"
            linkLabel="View All Documents"
          >
            {documents.length === 0 ? (
              <CompactEmptyState title="No documents uploaded yet" />
            ) : (
              <ul className="divide-y divide-border" role="list">
                {documents.map((doc) => (
                  <li key={doc.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex items-start gap-2.5">
                        <span className="mt-px shrink-0 text-text-muted"><FileIcon /></span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">{doc.fileName}</p>
                          <p className="text-[0.75rem] text-text-muted">
                            {formatDate(doc.createdAt)}{doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
                          </p>
                        </div>
                      </div>
                      {doc.status && (
                        <span className="shrink-0 inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold bg-success-bg text-success">
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden />
                          {doc.status}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ClientWidget>

        </div>

        {/* Right column — Message Center */}
        <ClientWidget
          title="Message Center"
          subtitle="Your secure communications with your legal team"
          href="/dashboard/messages"
          linkLabel="Open Inbox"
        >
          {messages.length === 0 ? (
            <CompactEmptyState title="No messages yet" />
          ) : (
            <ul className="divide-y divide-border" role="list">
              {messages.map((msg) => {
                const unread = !msg.isRead && msg.sender?.role !== "borrower";
                return (
                  <li key={msg.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy truncate">
                          {msg.sender?.role === "lawyer" ? "Your Attorney" : "Legal Team"}
                        </p>
                        {msg.content && (
                          <p className="text-[0.8125rem] text-text-muted line-clamp-2 leading-snug mt-0.5">
                            {msg.content}
                          </p>
                        )}
                        <p className="text-[0.75rem] text-text-muted mt-1">
                          {formatDate(msg.updatedAt ?? msg.createdAt)}
                        </p>
                      </div>
                      {unread && (
                        <span
                          className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#dc2626] text-white text-[0.625rem] font-bold leading-none"
                          aria-label="Unread"
                        >
                          New
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ClientWidget>

      </div>

      {/* ── Trust footer ──────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-5 py-4 text-xs text-text-muted max-[640px]:flex-col max-[640px]:gap-2">
        <span className="inline-flex items-center gap-[5px]">
          <LockIcon /> 256-bit Encrypted
        </span>
        <span className="text-border max-[640px]:hidden" aria-hidden>•</span>
        <span className="inline-flex items-center gap-[5px]">
          <ShieldIcon /> Attorney-Client Privilege
        </span>
        <span className="text-border max-[640px]:hidden" aria-hidden>•</span>
        <span className="inline-flex items-center gap-[5px]">
          <ClockIcon /> Response within 48 hours
        </span>
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type MetricTone = "info" | "success" | "warning" | "danger" | "muted";

const METRIC_TONE_STYLES: Record<MetricTone, { border: string; value: string }> = {
  info:    { border: "border-l-[#2563eb]", value: "text-[#2563eb]" },
  success: { border: "border-l-success",   value: "text-success"   },
  warning: { border: "border-l-warning",   value: "text-warning"   },
  danger:  { border: "border-l-[#dc2626]", value: "text-[#dc2626]" },
  muted:   { border: "border-l-border",    value: "text-text-muted" },
};

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: MetricTone;
  icon: ReactNode;
}) {
  const { border, value: valueColor } = METRIC_TONE_STYLES[tone];
  return (
    <div
      className={`bg-white border border-border rounded-lg py-4 px-5 flex flex-col gap-2 shadow-sm transition-[box-shadow,transform] duration-200 ease-in-out hover:shadow-md hover:-translate-y-px border-l-[3px] ${border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-[0.05em] uppercase text-text-muted">{label}</span>
        <span className="text-text-muted opacity-60">{icon}</span>
      </div>
      <span className={`font-serif text-xl font-black leading-none ${valueColor}`}>{value}</span>
    </div>
  );
}

function ClientWidget({
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

// ── Case Progress Timeline ─────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  { id: 1, label: "Intake Submitted",    desc: "Your questionnaire has been received.", status: "complete" as const },
  { id: 2, label: "Case Review",         desc: "Your attorney is reviewing your file.", status: "active"   as const },
  { id: 3, label: "Document Collection", desc: "Additional supporting documents may be requested.", status: "pending" as const },
  { id: 4, label: "Strategy Call",       desc: "A consultation will be scheduled to discuss results.", status: "pending" as const },
  { id: 5, label: "Filing",              desc: "Adversary proceeding filed on your behalf.", status: "pending" as const },
];

type StepStatus = "complete" | "active" | "pending";

const STEP_STYLES: Record<StepStatus, { dot: string; label: string }> = {
  complete: { dot: "bg-success border-success text-white",           label: "text-navy" },
  active:   { dot: "bg-[#2563eb] border-[#2563eb] text-white",       label: "text-navy" },
  pending:  { dot: "bg-white border-border text-text-muted",         label: "text-text-muted" },
};

const STEP_BADGES: Record<StepStatus, { bg: string; label: string }> = {
  complete: { bg: "bg-success-bg text-success",   label: "Complete"   },
  active:   { bg: "bg-blue-50 text-[#2563eb]",    label: "In Progress" },
  pending:  { bg: "bg-bg-alt text-text-muted",     label: "Upcoming"   },
};

function CaseProgressTimeline() {
  return (
    <ol className="flex flex-col gap-0 list-none m-0 p-0" role="list">
      {PROGRESS_STEPS.map((step, index) => {
        const { dot, label: labelClass } = STEP_STYLES[step.status];
        const badge = STEP_BADGES[step.status];
        const isLast = index === PROGRESS_STEPS.length - 1;

        return (
          <li key={step.id} className="flex gap-4 relative">
            {/* Vertical connector line */}
            {!isLast && (
              <span
                className="absolute left-[13px] top-[28px] bottom-0 w-px bg-border"
                aria-hidden
              />
            )}

            {/* Step dot */}
            <span
              className={`relative z-[1] w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-px text-xs font-bold ${dot}`}
            >
              {step.status === "complete" ? <CheckMiniIcon /> : step.id}
            </span>

            {/* Step content */}
            <div className="pb-5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${labelClass}`}>{step.label}</span>
                <span className={`inline-flex items-center gap-1 py-0.5 px-2 rounded-full text-[0.7rem] font-semibold ${badge.bg}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-[0.8125rem] text-text-muted leading-snug mt-0.5">{step.desc}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CompactEmptyState({ title }: { title: string }) {
  return (
    <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-border bg-bg px-4 py-8 text-center">
      <p className="text-sm font-semibold text-text-muted">{title}</p>
    </div>
  );
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

function AlertIcon() {
  return (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>);
}

function FileSearchIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><circle cx="11" cy="15" r="3" /><line x1="13.5" y1="17" x2="16" y2="19.5" /></svg>);
}

function DocumentIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>);
}

function MessageIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
}

function FileIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>);
}

function CheckMiniIcon() {
  return (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>);
}

function LockIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>);
}

function ShieldIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
}

function ClockIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
}
