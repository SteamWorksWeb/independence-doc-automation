/**
 * src/app/admin/login/page.tsx
 *
 * Stealth Admin Gateway — the vault door.
 *
 * What's here: nothing except the AdminAuthForm.
 * No hero text, no navigation, no marketing.
 * The layout handles branding and background.
 */

import type { Metadata } from "next";
import AdminAuthForm from "@/components/auth/AdminAuthForm";

export const metadata: Metadata = {
  title: "Administration | The Independence Law Firm",
};

export default function AdminLoginPage() {
  return <AdminAuthForm />;
}
