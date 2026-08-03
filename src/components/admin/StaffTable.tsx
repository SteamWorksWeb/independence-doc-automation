"use client";

/**
 * src/components/admin/StaffTable.tsx
 *
 * Staff management table for SUPER_ADMIN users.
 *
 * Fetches GET /api/admin/super-admin/staff and renders a table with:
 *   - Name, Email, Role columns
 *   - Role badge (SUPER_ADMIN = gold, LAWYER = blue)
 *
 * Includes an "Invite Lawyer" button that opens InviteLawyerModal.
 * On successful invite, the staff list is re-fetched automatically.
 */

import { useState, useEffect, useCallback } from "react";
import InviteLawyerModal from "./InviteLawyerModal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "LAWYER" | "SUPER_ADMIN";
  createdAt?: string;
}

interface StaffListResponse {
  staff?: StaffMember[];
  data?: StaffMember[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffTable() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch staff list ──────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/super-admin/staff", {
        cache: "no-store",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(errData.message ?? `Server returned ${res.status}`);
      }

      const data = await res.json() as StaffListResponse;
      // Backend may return { staff: [] } or { data: [] } — handle both
      const list = data.staff ?? data.data ?? [];
      setStaff(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStaff();
  }, [fetchStaff]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[1.375rem] font-bold text-navy leading-tight">
            Staff & Invites
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Manage firm attorneys and send new staff invitations.
          </p>
        </div>
        <InviteLawyerModal onSuccess={fetchStaff} />
      </div>

      {/* ── Staff table card ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-text-muted">
            <SpinnerIcon />
            <span className="text-sm font-medium">Loading staff…</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertIcon />
            </div>
            <div>
              <p className="font-semibold text-[#b31e3c] text-sm">Failed to load staff</p>
              <p className="text-text-muted text-xs mt-0.5">{error}</p>
            </div>
            <button
              type="button"
              onClick={fetchStaff}
              className="mt-1 text-xs font-semibold text-navy underline underline-offset-2 hover:no-underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && staff.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-[#f0f2f8] flex items-center justify-center">
              <UsersIcon />
            </div>
            <div>
              <p className="font-semibold text-navy text-sm">No staff members yet</p>
              <p className="text-text-muted text-xs mt-0.5">
                Use "Invite Lawyer" to add your first attorney.
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && !error && staff.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-[#f8f9fc]">
                  <th className="text-left px-6 py-3.5 text-[0.7rem] font-bold tracking-[0.08em] uppercase text-text-muted">
                    Name
                  </th>
                  <th className="text-left px-6 py-3.5 text-[0.7rem] font-bold tracking-[0.08em] uppercase text-text-muted">
                    Email
                  </th>
                  <th className="text-left px-6 py-3.5 text-[0.7rem] font-bold tracking-[0.08em] uppercase text-text-muted">
                    Role
                  </th>
                  <th className="text-left px-6 py-3.5 text-[0.7rem] font-bold tracking-[0.08em] uppercase text-text-muted">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {staff.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-[#f8f9fc] transition-colors duration-100"
                  >
                    {/* Name */}
                    <td className="px-6 py-4 font-semibold text-navy whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1a2744] to-[#2d4070] flex items-center justify-center shrink-0">
                          <span className="text-[0.65rem] font-bold text-white/90 uppercase leading-none">
                            {(member.firstName?.[0] ?? "") + (member.lastName?.[0] ?? "")}
                          </span>
                        </div>
                        <span>
                          {member.firstName} {member.lastName}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-text-muted font-mono text-[0.8125rem]">
                      {member.email}
                    </td>

                    {/* Role badge */}
                    <td className="px-6 py-4">
                      <RoleBadge role={member.role} />
                    </td>

                    {/* Joined date */}
                    <td className="px-6 py-4 text-text-muted text-xs whitespace-nowrap">
                      {member.createdAt
                        ? new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }).format(new Date(member.createdAt))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && !error && staff.length > 0 && (
          <div className="px-6 py-3 border-t border-border/60 flex items-center justify-between bg-[#f8f9fc]">
            <p className="text-xs text-text-muted">
              {staff.length} {staff.length === 1 ? "member" : "members"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Role Badge ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: "LAWYER" | "SUPER_ADMIN" }) {
  if (role === "SUPER_ADMIN") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.7rem] font-bold tracking-[0.06em] uppercase bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        Super Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.7rem] font-bold tracking-[0.06em] uppercase bg-blue-50 text-blue-700 border border-blue-200">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
      Lawyer
    </span>
  );
}

// ── Inline Icons ──────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className="animate-spin opacity-50">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b31e3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8892a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
