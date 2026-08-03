/**
 * src/app/admin/settings/page.tsx
 *
 * Admin Profile Settings page — Server Component.
 *
 * Reads the admin_session JWT server-side to extract the RBAC role, then
 * passes it down to the AdminSettingsForm client component so the email
 * field can be conditionally unlocked for SUPER_ADMIN users.
 *
 * Fields: First Name, Last Name, Email (editable by SUPER_ADMIN), Phone Number
 */

import { getAdminSession } from "@/lib/admin-session";
import AdminSettingsForm from "@/components/admin/AdminSettingsForm";

export default async function AdminSettingsPage() {
  // Decode the session server-side so the client never sees the raw JWT
  const session = await getAdminSession();

  return <AdminSettingsForm role={session?.role ?? null} />;
}
