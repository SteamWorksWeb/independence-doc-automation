"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

type TabId = "intake" | "documents" | "messages" | "notes";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CaseProfile {
  client: ClientSummary;
  intakeSnapshot: Record<string, unknown> | null;
  documents: CaseDocument[];
  assignedTo: string | null;
  assignedToId: string | null;
}

interface AdminUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

interface ClientSummary {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  pipelineStatus?: string | null;
}

interface CaseDocument {
  id?: string | number;
  title?: string | null;
  fileName?: string | null;
  filename?: string | null;
  name?: string | null;
  documentType?: string | null;
  type?: string | null;
  createdAt?: string | null;
  uploadedAt?: string | null;
}

type DocActionState = "idle" | "viewing" | "deleting";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "intake", label: "Intake Overview" },
  { id: "documents", label: "Documents" },
  { id: "messages", label: "Messages" },
  { id: "notes", label: "Notes" },
];

const STATUS_STYLES: Record<string, string> = {
  "Pre-Filing": "bg-blue-50 text-blue-700 border-blue-200",
  "Wait to File": "bg-purple-50 text-purple-700 border-purple-200",
  Filed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Discharged: "bg-green-50 text-green-700 border-green-200",
};

export default function ClientCaseProfilePage({ params }: PageProps) {
  const { id } = use(params);
  const [profile, setProfile] = useState<CaseProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("intake");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/admin/clients/${id}/profile`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(readMessage(data) ?? `Profile request failed (${res.status})`);
        }

        setProfile(normalizeProfile(data));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load case profile.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
    return () => controller.abort();
  }, [id]);

  // Load admin user list for the assignment dropdown
  useEffect(() => {
    async function loadAdmins() {
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const users = Array.isArray(data)
          ? data
          : Array.isArray(data?.users)
          ? data.users
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setAdminUsers(users as AdminUser[]);
      } catch {
        // Non-fatal — dropdown falls back to empty list
      }
    }
    loadAdmins();
  }, []);

  const clientName = useMemo(() => {
    if (!profile) return "Client Profile";
    return getClientName(profile.client);
  }, [profile]);

  async function handleAssignmentChange(nextAdminId: string) {
    if (!profile) return;

    const previousId = profile.assignedToId;
    const previousName = profile.assignedTo;
    const assignedToId = nextAdminId === "" ? null : nextAdminId;

    // Optimistically update the display name from the adminUsers list
    const selectedUser = adminUsers.find((u) => u.id === nextAdminId);
    const displayName = selectedUser
      ? getAdminDisplayName(selectedUser)
      : null;

    setAssignmentError(null);
    setAssignSuccess(false);
    setIsAssigning(true);
    setProfile({ ...profile, assignedToId, assignedTo: displayName });

    try {
      const res = await fetch(`/api/admin/clients/${id}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(readMessage(data) ?? `Assignment failed (${res.status})`);
      }

      setAssignSuccess(true);
      setTimeout(() => setAssignSuccess(false), 2500);
    } catch (err) {
      // Rollback on error
      setProfile((current) =>
        current
          ? { ...current, assignedToId: previousId, assignedTo: previousName }
          : current
      );
      setAssignmentError(
        err instanceof Error ? err.message : "Unable to update assignment."
      );
    } finally {
      setIsAssigning(false);
    }
  }

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="flex max-w-[1100px] flex-col gap-5 animate-fade-in">
        <Breadcrumb current="Client Profile" />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="font-serif text-lg font-bold text-red-800">
            Failed to Load Case Profile
          </p>
          <p className="mt-1 text-sm text-red-700">
            {error ?? "An unexpected error occurred."}
          </p>
        </div>
        <Link href="/admin/clients" className="text-sm font-semibold text-navy">
          Back to Client Directory
        </Link>
      </div>
    );
  }

  const status = profile.client.pipelineStatus ?? profile.client.status ?? "Pre-Filing";
  // The select value is the admin's ID (or "" for unassigned)
  const assignmentValue = profile.assignedToId ?? "";

  return (
    <div className="flex max-w-[1200px] flex-col gap-6 animate-fade-in">
      <Breadcrumb current={clientName} />

      <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-[clamp(1.5rem,2.5vw,2rem)] font-black italic leading-tight text-navy">
                {clientName}
              </h1>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(status)}`}>
                {formatStatus(status)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-muted">
              <span>{profile.client.phone || "No phone on file"}</span>
              <span className="break-all">{profile.client.email || "No email on file"}</span>
            </div>
          </div>

          <div className="flex min-w-[220px] flex-col gap-2">
            <label
              htmlFor="assigned-to"
              className="text-xs font-bold uppercase tracking-[0.06em] text-text-muted"
            >
              Assigned To
            </label>
            <select
              id="assigned-to"
              value={assignmentValue}
              disabled={isAssigning}
              onChange={(event) => handleAssignmentChange(event.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm font-semibold text-text-primary shadow-sm outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/10 disabled:cursor-wait disabled:opacity-70"
            >
              <option value="">Unassigned</option>
              {adminUsers.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {getAdminDisplayName(admin)}
                </option>
              ))}
            </select>
            {assignSuccess && (
              <p className="text-xs font-semibold text-emerald-700" role="status">
                ✓ Assignment saved
              </p>
            )}
            {assignmentError && (
              <p className="text-xs font-medium text-red-700" role="alert">{assignmentError}</p>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="flex overflow-x-auto border-b border-border bg-bg">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-12 whitespace-nowrap border-b-2 px-5 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-crimson bg-white text-navy"
                  : "border-transparent text-text-muted hover:bg-white/70 hover:text-navy"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "intake" && (
            <IntakeOverview snapshot={profile.intakeSnapshot} />
          )}
          {activeTab === "documents" && (
            <DocumentsPanel clientId={id} documents={profile.documents} />
          )}
          {activeTab === "messages" && (
            <PlaceholderPanel title="Secure Messaging UI coming soon." />
          )}
          {activeTab === "notes" && (
            <PlaceholderPanel title="Internal Firm Notes coming soon." />
          )}
        </div>
      </section>
    </div>
  );
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-text-muted" aria-label="Breadcrumb">
      <Link href="/admin/clients" className="font-medium hover:text-navy">
        Clients
      </Link>
      <span aria-hidden>/</span>
      <span className="min-w-0 truncate text-text-secondary">{current}</span>
    </nav>
  );
}

function IntakeOverview({ snapshot }: { snapshot: Record<string, unknown> | null }) {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        No intake snapshot is available for this client yet.
      </div>
    );
  }

  const sections = [
    { title: "Military", entries: entriesFor(snapshot, ["military", "militaryStatus", "veteranStatus", "serviceBranch", "activeDuty", "disabledVeteran"]) },
    { title: "Financials", entries: entriesFor(snapshot, ["employment", "isEmployed", "monthlyIncome", "annualIncome", "householdSize", "totalDebt", "studentLoanDebt"]) },
    { title: "Expenses", entries: entriesFor(snapshot, ["expenses", "monthlyExpenses", "expFood", "expHousing", "expUtilities", "expTransportGas", "expCarInsurance"]) },
  ];

  return (
    <div className="grid gap-5">
      {sections.map((section) => (
        <section key={section.title} className="rounded-lg border border-border">
          <h2 className="border-b border-border px-5 py-3 font-serif text-base font-bold text-navy">
            {section.title}
          </h2>
          {section.entries.length > 0 ? (
            <dl className="grid grid-cols-1 gap-0 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.entries.map(([label, value]) => (
                <div key={label} className="rounded-md px-3 py-3">
                  <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-muted">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-text-primary">
                    {formatValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="px-5 py-5 text-sm italic text-text-muted">
              No {section.title.toLowerCase()} details provided.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function DocumentsPanel({
  clientId,
  documents: initialDocuments,
}: {
  clientId: string;
  documents: CaseDocument[];
}) {
  const [documents, setDocuments] = useState<CaseDocument[]>(initialDocuments);
  const [actionStates, setActionStates] = useState<Record<string, DocActionState>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  function docId(document: CaseDocument, index: number): string {
    return String(document.id ?? `${document.fileName ?? document.name}-${index}`);
  }

  async function handleView(document: CaseDocument, index: number) {
    const key = docId(document, index);
    if (!document.id) {
      setActionErrors((prev) => ({ ...prev, [key]: "Document ID is missing." }));
      return;
    }

    setActionStates((prev) => ({ ...prev, [key]: "viewing" }));
    setActionErrors((prev) => ({ ...prev, [key]: "" }));

    try {
      const res = await fetch(`/api/admin/documents/${document.id}/view`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (typeof data.message === "string" ? data.message : null) ?? `Request failed (${res.status})`;
        throw new Error(msg);
      }

      const url = typeof data.url === "string" ? data.url : null;
      if (!url) throw new Error("No URL returned from server.");

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Unable to open document.",
      }));
    } finally {
      setActionStates((prev) => ({ ...prev, [key]: "idle" }));
    }
  }

  async function handleDelete(document: CaseDocument, index: number) {
    const key = docId(document, index);
    if (!document.id) {
      setActionErrors((prev) => ({ ...prev, [key]: "Document ID is missing." }));
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this document? This cannot be undone."
    );
    if (!confirmed) return;

    setActionStates((prev) => ({ ...prev, [key]: "deleting" }));
    setActionErrors((prev) => ({ ...prev, [key]: "" }));

    try {
      const res = await fetch(`/api/admin/documents/${document.id}`, {
        method: "DELETE",
        cache: "no-store",
      });

      if (res.status === 204 || res.ok) {
        // Optimistically remove the deleted document from local state
        setDocuments((prev) => prev.filter((_, i) => i !== index));
        return;
      }

      const data = await res.json().catch(() => ({}));
      const msg = (typeof data.message === "string" ? data.message : null) ?? `Delete failed (${res.status})`;
      throw new Error(msg);
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Unable to delete document.",
      }));
    } finally {
      setActionStates((prev) => ({ ...prev, [key]: "idle" }));
    }
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        No uploaded documents are attached to this client yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((document, index) => {
        const key = docId(document, index);
        const state = actionStates[key] ?? "idle";
        const error = actionErrors[key];
        return (
          <article
            key={key}
            className="flex min-h-[150px] flex-col justify-between rounded-lg border border-border p-4"
          >
            <div>
              {/* Primary: custom title (bold). Fallback to filename for legacy docs. */}
              <p className="break-words font-bold text-text-primary">
                {document.title?.trim() || (document.fileName ?? document.filename ?? document.name ?? "Untitled document")}
              </p>
              {/* Secondary: actual filename (muted subtitle), shown only when title differs */}
              {document.title?.trim() && (
                <p className="mt-1 text-xs text-text-muted break-all">
                  {document.fileName ?? document.filename ?? document.name}
                </p>
              )}
              <p className="mt-2 text-sm text-text-muted">
                {document.documentType ?? document.type ?? "Document"}
              </p>
            </div>

            {error && (
              <p className="mt-2 text-xs font-medium text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              {/* View/Download button */}
              <button
                id={`doc-view-${key}`}
                type="button"
                disabled={state !== "idle"}
                onClick={() => handleView(document, index)}
                className="h-9 rounded-md border border-border px-3 text-sm font-bold text-navy transition hover:border-navy hover:bg-bg disabled:cursor-wait disabled:opacity-60"
                aria-label={`View document: ${document.fileName ?? document.name ?? "Untitled"}`}
              >
                {state === "viewing" ? "Opening…" : "View / Download"}
              </button>

              {/* Delete button */}
              <button
                id={`doc-delete-${key}`}
                type="button"
                disabled={state !== "idle"}
                onClick={() => handleDelete(document, index)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-600 transition hover:border-red-500 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                aria-label={`Delete document: ${document.fileName ?? document.name ?? "Untitled"}`}
                title="Delete document"
              >
                {state === "deleting" ? (
                  <span className="text-xs font-bold">…</span>
                ) : (
                  <TrashIcon />
                )}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="font-serif text-lg font-bold text-navy">{title}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex max-w-[1200px] flex-col gap-6 animate-pulse">
      <div className="h-4 w-56 rounded bg-border" />
      <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap justify-between gap-6">
          <div className="space-y-3">
            <div className="h-8 w-72 rounded bg-border" />
            <div className="h-4 w-96 max-w-full rounded bg-border" />
          </div>
          <div className="h-10 w-56 rounded bg-border" />
        </div>
      </div>
      <div className="h-[360px] rounded-lg border border-border bg-white shadow-sm" />
    </div>
  );
}

function normalizeProfile(data: unknown): CaseProfile {
  const record = isRecord(data) ? data : {};
  const nestedProfile = firstRecord(record, ["profile", "caseProfile", "data"]) ?? record;
  const client = firstRecord(nestedProfile, ["client", "borrower"]) ?? nestedProfile;
  const intakeSnapshot =
    firstRecord(nestedProfile, ["intakeSnapshot", "intake", "snapshot"]) ??
    firstRecord(client, ["intakeProfile"]) ??
    null;
  const documents =
    firstArray(nestedProfile, ["documents", "uploadedDocuments"]) ??
    firstArray(client, ["documents"]) ??
    [];

  // Read the ID of the assigned admin (UUID string) — used to seed the select value
  const assignedToId = readAssignedToId(nestedProfile) ?? readAssignedToId(client) ?? null;

  return {
    client: toClientSummary(client),
    intakeSnapshot,
    documents: documents.filter(isRecord) as CaseDocument[],
    assignedTo: readAssignment(nestedProfile) ?? readAssignment(client) ?? null,
    assignedToId,
  };
}

function toClientSummary(source: Record<string, unknown>): ClientSummary {
  return {
    id: typeof source.id === "string" ? source.id : "",
    firstName: readOptionalString(source.firstName),
    lastName: readOptionalString(source.lastName),
    fullName: readOptionalString(source.fullName),
    name: readOptionalString(source.name),
    email: readOptionalString(source.email),
    phone: readOptionalString(source.phone),
    status: readOptionalString(source.status),
    pipelineStatus: readOptionalString(source.pipelineStatus),
  };
}

function readOptionalString(value: unknown): string | null | undefined {
  return typeof value === "string" ? value : value === null ? null : undefined;
}

function firstRecord(
  source: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) return value;
  }
  return null;
}

function firstArray(source: Record<string, unknown>, keys: string[]): unknown[] | null {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

function readAssignment(source: unknown): string | null | undefined {
  if (!isRecord(source)) return undefined;
  const direct = source.assignedTo ?? source.assignee ?? source.staffAssigned;
  if (typeof direct === "string") return direct;
  if (direct === null) return null;

  const staff = source.staffAssignment;
  if (isRecord(staff)) {
    const name = staff.name ?? staff.fullName ?? staff.assignedTo;
    if (typeof name === "string") return name;
  }

  return undefined;
}

function readAssignedToId(source: unknown): string | null | undefined {
  if (!isRecord(source)) return undefined;
  const id =
    source.assignedToId ??
    source.assignedTo_id ??
    (isRecord(source.assignedTo) ? source.assignedTo.id : undefined) ??
    (isRecord(source.staffAssignment) ? source.staffAssignment.id : undefined);
  if (typeof id === "string") return id;
  if (id === null) return null;
  return undefined;
}

function entriesFor(
  snapshot: Record<string, unknown>,
  keys: string[]
): Array<[string, unknown]> {
  const rows: Array<[string, unknown]> = [];

  for (const key of keys) {
    const value = snapshot[key];
    if (isRecord(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        rows.push([humanize(nestedKey), nestedValue]);
      }
    } else if (value !== undefined && value !== null && value !== "") {
      rows.push([humanize(key), value]);
    }
  }

  return rows;
}

function getClientName(client: ClientSummary): string {
  if (client.fullName) return client.fullName;
  if (client.name) return client.name;

  const parts = [client.firstName, client.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");

  return client.email ?? "Client Profile";
}

function getAdminDisplayName(admin: AdminUser): string {
  const parts = [admin.firstName, admin.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return admin.email ?? "Unknown admin";
}

function getStatusClass(status: string): string {
  return STATUS_STYLES[formatStatus(status)] ?? "bg-slate-50 text-slate-700 border-slate-200";
}

function formatStatus(status: string): string {
  const normalized = status.trim().toLowerCase().replace(/[_\s-]+/g, " ");
  const knownStatuses: Record<string, string> = {
    "pre filing": "Pre-Filing",
    "wait to file": "Wait to File",
    filed: "Filed",
    discharged: "Discharged",
  };

  return (
    knownStatuses[normalized] ??
    normalized.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1))
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (Number.isFinite(value) && Math.abs(value) >= 100) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    }
    return String(value);
  }
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${humanize(key)}: ${formatValue(nestedValue)}`)
      .join("; ");
  }
  return typeof value === "string" && value.trim() ? value : "Not provided";
}

function humanize(key: string): string {
  return key
    .replace(/^exp/, "expense")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readMessage(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const message = data.message ?? data.error;
  return typeof message === "string" ? message : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
