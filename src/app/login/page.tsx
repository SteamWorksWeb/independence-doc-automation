/**
 * src/app/login/page.tsx
 *
 * Client Login Page — two-column layout with brand sidebar.
 *
 * Left:  AuthSidebar (logo + navy/gradient background)
 * Right: ClientLoginForm (Welcome Back card)
 */

import { Suspense } from "react";
import "../globals.css";
import ClientLoginForm from "@/components/auth/ClientLoginForm";
import {
  AuthLayout,
  AuthSidebar,
  AuthFormPanel,
} from "@/components/auth/AuthSidebar";

/** Minimal skeleton shown while the form suspends during hydration */
function LoginSkeleton() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "460px",
        minHeight: "420px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.06)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
      aria-hidden
    />
  );
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <AuthSidebar />
      <AuthFormPanel>
        <Suspense fallback={<LoginSkeleton />}>
          <ClientLoginForm />
        </Suspense>
      </AuthFormPanel>
    </AuthLayout>
  );
}
