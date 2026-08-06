/**
 * src/app/(public)/intake/page.tsx
 *
 * Legacy intake route — permanent redirect to /register
 *
 * Old invite emails pointed to /intake?token=<token>. Those links still work
 * because this page immediately redirects to the correct registration route.
 * No form is rendered here; the full 7-step wizard lives at /onboarding (after
 * the borrower completes account setup at /register?token=<token>).
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Redirecting… | Liberty",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface IntakePageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

function normalizeToken(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const params = await searchParams;
  const token = normalizeToken(params.token);

  if (token) {
    redirect(`/register?token=${encodeURIComponent(token)}`);
  }

  // No token — redirect to the login page rather than showing an error UI
  redirect("/login");
}
