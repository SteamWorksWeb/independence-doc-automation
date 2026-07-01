/**
 * src/app/login/page.tsx
 *
 * Client Login Page — thin page that renders the ClientLoginForm component.
 * Metadata is declared at the layout level.
 */

import "../globals.css";
import ClientLoginForm from "@/components/auth/ClientLoginForm";

export default function LoginPage() {
  return <ClientLoginForm />;
}
