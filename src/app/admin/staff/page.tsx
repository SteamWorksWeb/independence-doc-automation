/**
 * src/app/admin/staff/page.tsx
 *
 * Staff & Invites — SUPER_ADMIN only page.
 *
 * Server-side RBAC guard: decodes admin_session and redirects
 * non-SUPER_ADMIN users to /admin/dashboard before any rendering occurs.
 * (The middleware already does this, but defence-in-depth is good practice.)
 *
 * Metadata: robots noindex — internal admin tooling only.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import StaffTable from "@/components/admin/StaffTable";

export const metadata: Metadata = {
  title: "Staff & Invites | Independence Law Admin",
  robots: { index: false, follow: false },
};

export default async function StaffPage() {
  // ── Server-side RBAC guard ─────────────────────────────────────────────────
  const session = await getAdminSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/admin/dashboard");
  }

  // ── Page content ───────────────────────────────────────────────────────────
  return <StaffTable />;
}
