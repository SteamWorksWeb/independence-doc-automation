/**
 * src/components/client/ClientShell.tsx
 *
 * Shared authenticated client shell — used by every /dashboard/* route layout.
 *
 * Structure:
 *   ┌──────────────────────────────────────────────────┐
 *   │  ClientSidebar (240px, sticky, bg-navy)           │
 *   │─────────────────────────────────────────────────│
 *   │  Top bar  (CLIENT PORTAL label + Secure Session) │
 *   │           (+ client name / email badge)           │
 *   │  {children}                                       │
 *   └──────────────────────────────────────────────────┘
 *
 * Email resolution: reads the client JWT cookie and extracts email
 * directly (same approach as dashboard/page.tsx) to avoid a middleware
 * header injection dependency.
 */

import ClientSidebar from "@/components/client/ClientSidebar";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const BORROWER_SESSION_COOKIE_NAMES = ["borrower_session", "client_token"] as const;

async function getClientEmailFromCookie(): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return "";

  try {
    const cookieStore = await cookies();
    const token = BORROWER_SESSION_COOKIE_NAMES
      .map((name) => cookieStore.get(name)?.value)
      .find((v): v is string => !!v);

    if (!token) return "";

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
      { algorithms: ["HS256"] }
    );

    if (typeof payload.email === "string") return payload.email.trim();

    // Try nested structures some backends use
    if (
      payload.user &&
      typeof payload.user === "object" &&
      "email" in payload.user &&
      typeof (payload.user as Record<string, unknown>).email === "string"
    ) {
      return ((payload.user as Record<string, unknown>).email as string).trim();
    }

    return "";
  } catch {
    return "";
  }
}

export default async function ClientShell({ children }: { children: ReactNode }) {
  const clientEmail = await getClientEmailFromCookie();

  return (
    <div className="flex min-h-dvh bg-[#eef0f5]">
      {/* Permanent / off-canvas sidebar */}
      <ClientSidebar />

      {/* Main content column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <header className="h-14 bg-white border-b border-border flex items-center justify-between px-7 max-[900px]:px-4 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3.5 max-[900px]:gap-2.5">
            <span className="font-sans text-[0.8125rem] font-semibold text-text-muted tracking-[0.08em] uppercase max-[480px]:hidden">
              Client Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Secure Session badge */}
            <span className="flex items-center gap-1.5 font-sans text-xs font-semibold text-success bg-success-bg py-1 px-2.5 rounded-[20px]">
              <span
                className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0"
                aria-hidden
              />
              Secure Session
            </span>

            {/* Client email badge — only shown when available */}
            {clientEmail && (
              <span className="hidden sm:flex items-center gap-1.5 font-sans text-xs font-medium text-text-muted bg-bg border border-border py-1 px-2.5 rounded-[20px] max-w-[200px] truncate">
                <UserAvatarIcon />
                <span className="truncate">{clientEmail}</span>
              </span>
            )}
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────────────────────── */}
        <div className="flex-1 py-8 px-7 max-[900px]:py-5 max-[900px]:px-4 overflow-y-auto">
          {children}
        </div>

      </div>
    </div>
  );
}

// ── Inline icon ────────────────────────────────────────────────────────────────

function UserAvatarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
