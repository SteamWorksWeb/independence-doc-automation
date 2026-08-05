/**
 * src/app/admin/login/page.tsx
 *
 * Stealth Admin Gateway — two-column layout with brand sidebar.
 *
 * Left:  AuthSidebar (logo + navy/gradient background)
 * Right: AdminAuthForm (the vault door login card)
 */

import type { Metadata } from "next";
import AdminAuthForm from "@/components/auth/AdminAuthForm";
import {
  AuthLayout,
  AuthSidebar,
  AuthFormPanel,
} from "@/components/auth/AuthSidebar";

export const metadata: Metadata = {
  title: "Administration | Liberty",
};

export default function AdminLoginPage() {
  return (
    <AuthLayout>
      <AuthSidebar />
      <AuthFormPanel>
        <AdminAuthForm />
      </AuthFormPanel>
    </AuthLayout>
  );
}
