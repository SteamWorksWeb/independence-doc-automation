/**
 * src/components/admin/ClientFilterTable.tsx
 *
 * Interactive, filterable client table for the Client Directory.
 *
 * Receives the full list of clients (server-fetched) and implements
 * client-side filtering with pill-style status filter buttons.
 *
 * Client statuses: Pre-Filing -> Filed
 *
 * The Action column provides a dropdown to update a client's status
 * via PATCH /admin/clients/:id/status.
 */

"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClientStatus =
  | "Pre-Filing"
  | "Filed";

export interface ClientRow {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  createdAt: string;
  isVerified: boolean;
  isArchived?: boolean | null;
  intakeProfile: { isCompleted: boolean; [key: string]: unknown } | null;
  status: ClientStatus;
}

type FilterOption = "All" | ClientStatus;

interface ClientFilterTableProps {
  clients: ClientRow[];
  adminToken: string;
  archiveMode?: boolean;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

// ── Status transition map (context-aware actions per status) ──────────────────

const STATUS_ACTIONS: { label: string; target: ClientStatus; style: string }[] = [
  { label: "Mark as Pre-Filing", target: "Pre-Filing", style: "text-[#2563eb] hover:bg-[#eff4ff]" },
  { label: "Mark as Filed", target: "Filed", style: "text-success hover:bg-success-bg" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  const dots = "•".repeat(Math.max(0, local.length - 3));
  return `${visible}${dots}@${domain}`;
}

// ── Filter pill config ────────────────────────────────────────────────────────

function getClientDisplayName(client: ClientRow): string {
  const fullName = [client.firstName, client.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || client.email;
}

function getClientActionLabel(client: ClientRow): string {
  return getClientDisplayName(client) || client.email || "this client";
}

const FILTER_OPTIONS: { value: FilterOption; label: string; icon?: React.ReactElement }[] = [
  { value: "All", label: "All" },
  {
    value: "Pre-Filing",
    label: "Pre-Filing",
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  },
  {
    value: "Filed",
    label: "Filed",
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>,
  },
];

// Active filter pill styling per status
const ACTIVE_PILL_STYLES: Record<FilterOption, string> = {
  All: "bg-navy text-white shadow-sm",
  "Pre-Filing": "bg-[#2563eb] text-white shadow-sm",
  Filed: "bg-success text-white shadow-sm",
};

// ── Status badge color map ────────────────────────────────────────────────────

const STATUS_BADGE_STYLES: Record<ClientStatus, string> = {
  "Pre-Filing": "bg-[#eff4ff] text-[#2563eb]",
  Filed: "bg-success-bg text-success",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientFilterTable({ clients: initialClients, adminToken, archiveMode = false }: ClientFilterTableProps) {
  const [clients, setClients] = useState<ClientRow[]>(initialClients);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [deleteClient, setDeleteClient] = useState<ClientRow | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync with server data if it changes (e.g. page re-render)
  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    if (openDropdown) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [openDropdown]);

  // ── Status change handler ─────────────────────────────────────────────────

  const handleStatusChange = useCallback(
    async (clientId: string, newStatus: ClientStatus) => {
      if (updatingId) return;

      setUpdatingId(clientId);
      setOpenDropdown(null);

      // Store original state for rollback
      const previousClients = [...clients];

      // Optimistic update
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
      );

      try {
        const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
        const res = await fetch(`${apiUrl}/admin/clients/${clientId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as Record<string, string>).error ||
            (body as Record<string, string>).message ||
            `Server responded with ${res.status}`
          );
        }

        const clientEmail =
          clients.find((c) => c.id === clientId)?.email ?? "Client";
        setToast({
          message: `${clientEmail} → ${newStatus}`,
          type: "success",
        });
      } catch (err) {
        // Rollback on failure
        setClients(previousClients);
        setToast({
          message: err instanceof Error ? err.message : "Failed to update status.",
          type: "error",
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [adminToken, clients, updatingId]
  );

  const handleArchiveClient = useCallback(
    async (clientId: string) => {
      if (updatingId) return;

      const targetClient = clients.find((c) => c.id === clientId);
      const clientLabel = targetClient ? getClientActionLabel(targetClient) : "Client";
      const previousClients = [...clients];

      setUpdatingId(clientId);
      setOpenDropdown(null);
      setClients((prev) => prev.filter((c) => c.id !== clientId));

      try {
        const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
        if (!apiUrl) throw new Error("Backend API URL is not configured.");

        const res = await fetch(`${apiUrl}/admin/clients/${clientId}/archive`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ isArchived: true }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as Record<string, string>).error ||
            (body as Record<string, string>).message ||
            `Server responded with ${res.status}`
          );
        }

        setToast({
          message: `${clientLabel} archived.`,
          type: "success",
        });
      } catch (err) {
        setClients(previousClients);
        setToast({
          message: err instanceof Error ? err.message : "Failed to archive client.",
          type: "error",
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [adminToken, clients, updatingId]
  );

  const handleRestoreClient = useCallback(
    async (clientId: string) => {
      if (updatingId) return;

      const targetClient = clients.find((c) => c.id === clientId);
      const clientLabel = targetClient ? getClientActionLabel(targetClient) : "Client";
      const previousClients = [...clients];

      setUpdatingId(clientId);
      setOpenDropdown(null);
      setClients((prev) => prev.filter((c) => c.id !== clientId));

      try {
        const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
        if (!apiUrl) throw new Error("Backend API URL is not configured.");

        const res = await fetch(`${apiUrl}/admin/clients/${clientId}/archive`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ isArchived: false }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as Record<string, string>).error ||
            (body as Record<string, string>).message ||
            `Server responded with ${res.status}`
          );
        }

        setToast({
          message: `${clientLabel} restored.`,
          type: "success",
        });
      } catch (err) {
        setClients(previousClients);
        setToast({
          message: err instanceof Error ? err.message : "Failed to restore client.",
          type: "error",
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [adminToken, clients, updatingId]
  );

  const visibleClients = useMemo(
    () => clients.filter((c) => archiveMode ? c.isArchived === true : c.isArchived !== true),
    [archiveMode, clients]
  );

  const handleDeleteClient = useCallback(async () => {
    if (!deleteClient || updatingId) return;

    const clientId = deleteClient.id;
    const clientLabel = getClientActionLabel(deleteClient);
    const previousClients = [...clients];

    setUpdatingId(clientId);
    setClients((prev) => prev.filter((c) => c.id !== clientId));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_AWS_API_URL;
      if (!apiUrl) throw new Error("Backend API URL is not configured.");

      const res = await fetch(`${apiUrl}/admin/clients/${clientId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).error ||
          (body as Record<string, string>).message ||
          `Server responded with ${res.status}`
        );
      }

      setDeleteClient(null);
      setToast({
        message: `${clientLabel} permanently deleted.`,
        type: "success",
      });
    } catch (err) {
      setClients(previousClients);
      setToast({
        message: err instanceof Error ? err.message : "Failed to delete client.",
        type: "error",
      });
    } finally {
      setUpdatingId(null);
    }
  }, [adminToken, clients, deleteClient, updatingId]);

  // Derive counts per status (always from full list)
  const counts = useMemo(() => {
    const map: Record<FilterOption, number> = {
      All: visibleClients.length,
      "Pre-Filing": 0,
      Filed: 0,
    };
    for (const c of visibleClients) {
      map[c.status] = (map[c.status] ?? 0) + 1;
    }
    return map;
  }, [visibleClients]);

  // Filtered client list
  const filtered = useMemo(
    () => activeFilter === "All" ? visibleClients : visibleClients.filter((c) => c.status === activeFilter),
    [activeFilter, visibleClients]
  );

  return (
    <>
      {/* ── Filter bar ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3.5 border-b border-border bg-[#fafbfc] overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <span className="text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted whitespace-nowrap mr-1">
          Filter:
        </span>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setActiveFilter(opt.value)}
              className={`inline-flex items-center gap-1.5 py-[5px] px-3 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap border cursor-pointer transition-all duration-150 ease-in-out ${
                isActive
                  ? `${ACTIVE_PILL_STYLES[opt.value]} border-transparent`
                  : "bg-white border-border text-text-secondary hover:border-navy hover:text-navy"
              }`}
              aria-pressed={isActive}
            >
              {opt.icon}
              {opt.label}
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.625rem] font-bold leading-none ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-bg-alt text-text-muted"
                }`}
              >
                {counts[opt.value]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Empty filter state ──────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center text-center py-12 px-6 gap-2">
          <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center text-text-muted mb-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="font-serif text-sm font-bold text-text-primary">
            No clients match &ldquo;{activeFilter}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setActiveFilter("All")}
            className="text-xs font-semibold text-crimson hover:underline cursor-pointer bg-transparent border-none"
          >
            Clear filter →
          </button>
        </div>
      )}

      {/* ── Data table ──────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full border-collapse text-sm min-w-[640px]" aria-label="Client directory">
            <thead>
              <tr>
                {["#", "Client Name", "Joined Date", "Status", "Action"].map((h, i) => (
                  <th
                    key={h}
                    className={`py-[11px] px-4 text-left text-[0.6875rem] font-bold tracking-[0.07em] uppercase text-text-muted bg-bg border-b border-border whitespace-nowrap select-none ${i === 0 ? "pl-6" : ""} ${i === 4 ? "pr-6" : ""}`}
                    scope="col"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((client, index) => (
                <tr
                  key={client.id}
                  className="border-b border-border last:border-b-0 transition-[background] duration-fast hover:bg-[#fafbfc]"
                >
                  <td className="py-3.5 px-4 pl-6 text-text-muted text-[0.8125rem] font-medium w-10 align-middle">
                    {index + 1}
                  </td>
                  <td className="py-3.5 px-4 font-medium max-w-[280px] align-middle">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="group flex min-w-0 flex-col gap-0.5 text-navy no-underline transition-[color] duration-fast hover:text-crimson"
                      title={`${getClientDisplayName(client)} (${client.email})`}
                    >
                      <span className="block truncate font-bold text-text-primary group-hover:text-crimson group-hover:underline">
                        {getClientDisplayName(client)}
                      </span>
                      <span className="block truncate text-[0.75rem] font-medium text-text-muted group-hover:text-crimson/80">
                        <span className="inline max-[640px]:hidden">{client.email}</span>
                        <span className="hidden max-[640px]:inline" aria-hidden>
                          {obfuscateEmail(client.email)}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap align-middle">
                    {formatDate(client.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 align-middle">
                    <span
                      className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${STATUS_BADGE_STYLES[client.status]}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-80" aria-hidden />
                      {client.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 pr-6 align-middle">
                    <StatusActionCell
                      client={client}
                      isOpen={openDropdown === client.id}
                      isUpdating={updatingId === client.id}
                      onToggle={() => setOpenDropdown(openDropdown === client.id ? null : client.id)}
                      onStatusChange={handleStatusChange}
                      onArchive={handleArchiveClient}
                      onRestore={handleRestoreClient}
                      onRequestDelete={(selectedClient) => {
                        setOpenDropdown(null);
                        setDeleteClient(selectedClient);
                      }}
                      archiveMode={archiveMode}
                      dropdownRef={openDropdown === client.id ? dropdownRef : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Table footer ────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="py-3 px-6 border-t border-border bg-bg flex items-center justify-between">
          <span className="text-[0.8125rem] text-text-muted">
            {activeFilter !== "All" && (
              <>Filtered: <strong className="text-text-primary">{activeFilter}</strong> · </>
            )}
            Showing {filtered.length} of {visibleClients.length} {visibleClients.length === 1 ? "client" : "clients"}
          </span>
          {activeFilter !== "All" && (
            <button
              type="button"
              onClick={() => setActiveFilter("All")}
              className="text-xs font-semibold text-crimson hover:underline cursor-pointer bg-transparent border-none"
            >
              Show all →
            </button>
          )}
        </div>
      )}

      {/* ── Toast notification ──────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 flex items-center gap-2 text-white py-3 px-5 rounded-lg font-sans text-[0.8125rem] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.18)] z-[1000] animate-toast-in ${
            toast.type === "success" ? "bg-success" : "bg-crimson"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.type === "success" ? <CheckIcon /> : <AlertIcon />}
          {toast.message}
        </div>
      )}

      {deleteClient && (
        <DeleteClientDialog
          client={deleteClient}
          isDeleting={updatingId === deleteClient.id}
          onCancel={() => setDeleteClient(null)}
          onConfirm={handleDeleteClient}
        />
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Per-row action cell: Manage dropdown */
function StatusActionCell({
  client,
  isOpen,
  isUpdating,
  onToggle,
  onStatusChange,
  onArchive,
  onRestore,
  onRequestDelete,
  archiveMode,
  dropdownRef,
}: {
  client: ClientRow;
  isOpen: boolean;
  isUpdating: boolean;
  onToggle: () => void;
  onStatusChange: (clientId: string, newStatus: ClientStatus) => void;
  onArchive: (clientId: string) => void;
  onRestore: (clientId: string) => void;
  onRequestDelete: (client: ClientRow) => void;
  archiveMode: boolean;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex items-center gap-2" ref={dropdownRef}>
      <div className="relative">
        <button
          type="button"
          id={`status-menu-trigger-${client.id}`}
          onClick={onToggle}
          disabled={isUpdating}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md border border-[#2563eb] text-[#2563eb] text-[0.8125rem] font-semibold bg-white hover:bg-[#eff4ff] transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label={`Open actions for ${client.email}`}
        >
          {isUpdating ? (
            <span className="w-3.5 h-3.5 border-2 border-border border-t-crimson rounded-full animate-spin" aria-hidden />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
            </svg>
          )}
          Manage
        </button>

        {/* Dropdown menu */}
        {isOpen && !isUpdating && (
          <div
            className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[190px] bg-white rounded-lg border border-border shadow-lg py-1 animate-fade-in"
            role="menu"
            aria-labelledby={`status-menu-trigger-${client.id}`}
          >
            <div className="px-3 py-2 border-b border-border">
              <span className="text-[0.625rem] font-bold tracking-[0.08em] uppercase text-text-muted">
                Change Status
              </span>
            </div>
            {STATUS_ACTIONS.map((action) => (
              <button
                key={action.target}
                type="button"
                role="menuitem"
                className={`w-full text-left px-3 py-2 text-[0.8125rem] font-semibold cursor-pointer border-none bg-transparent transition-[background,color] duration-150 ease-in-out ${action.style}`}
                onClick={() => onStatusChange(client.id, action.target)}
              >
                {action.label}
              </button>
            ))}
            <div className="border-t border-border px-3 py-2">
              <span className="text-[0.625rem] font-bold tracking-[0.08em] uppercase text-text-muted">
                Client Actions
              </span>
            </div>
            {archiveMode ? (
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold text-success cursor-pointer border-none bg-transparent transition-[background,color] duration-150 ease-in-out hover:bg-success-bg"
                onClick={() => onRestore(client.id)}
              >
                Restore Client
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold text-warning cursor-pointer border-none bg-transparent transition-[background,color] duration-150 ease-in-out hover:bg-warning-bg"
                onClick={() => onArchive(client.id)}
              >
                Archive Client
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 text-[0.8125rem] font-semibold text-red-600 cursor-pointer border-none bg-transparent transition-[background,color] duration-150 ease-in-out hover:bg-red-50"
              onClick={() => onRequestDelete(client)}
            >
              Delete Client
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteClientDialog({
  client,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  client: ClientRow;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center px-4"
      style={{ background: "rgba(17,24,39,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && !isDeleting && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-client-title"
    >
      <div className="w-full max-w-[440px] bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <TrashIcon color="white" />
          </div>
          <h3 id="delete-client-title" className="font-serif font-bold text-white text-[1.0625rem]">
            Permanently Delete Client
          </h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-[0.9rem] text-text-secondary leading-relaxed">
            Are you sure you want to delete{" "}
            <strong className="text-text-primary">{getClientActionLabel(client)}</strong>
            ? This action cannot be undone and all client data will be permanently removed.
          </p>
          <p className="mt-3 text-[0.8125rem] text-text-muted break-all">{client.email}</p>
        </div>
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-lg border border-border text-[0.875rem] font-semibold text-text-secondary bg-white hover:bg-bg transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-[0.875rem] font-bold hover:bg-red-700 transition-colors duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Permanently Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline SVG Icons ────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TrashIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
