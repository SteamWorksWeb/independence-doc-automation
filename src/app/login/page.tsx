/**
 * src/app/login/page.tsx
 *
 * Client Login Page — thin page that renders the ClientLoginForm component.
 *
 * The <Suspense> boundary is required by Next.js App Router whenever a
 * client component calls useSearchParams(). Without it, the component is
 * statically rendered and never sees the ?token= query parameter, leaving
 * the form stuck in "Welcome Back" mode even when an invite token is present.
 */

import { Suspense } from "react";
import "../globals.css";
import ClientLoginForm from "@/components/auth/ClientLoginForm";

/** Minimal skeleton shown while the form suspends during hydration */
function LoginSkeleton() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        margin: "0 auto",
        minHeight: "420px",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.04)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
      aria-hidden
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <ClientLoginForm />
    </Suspense>
  );
}
