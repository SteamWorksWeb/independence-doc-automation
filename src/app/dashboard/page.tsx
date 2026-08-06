/**
 * src/app/dashboard/page.tsx
 *
 * Client Dashboard — Command Center
 *
 * Layout: 2-column grid (Case Status + Documents), then Messages spanning full width.
 * Case Status: decodes JWT cookie to surface client identity + status pill.
 * Documents / Messages: mock data scaffolded for future API wiring.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const metadata: Metadata = {
  title: "My Dashboard",
};

export const maxDuration = 60;

// ── Session helper ────────────────────────────────────────────────────────────

async function getClientSession(): Promise<{ email: string; sub: string } | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;

  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("client_token")?.value ??
      cookieStore.get("borrower_session")?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
      { algorithms: ["HS256"] }
    );

    return {
      sub:   typeof payload.sub   === "string" ? payload.sub   : "",
      email: typeof payload.email === "string" ? payload.email : "",
    };
  } catch {
    return null;
  }
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_MESSAGES = [
  { id: 1, sender: "Attorney Rivera",   snippet: "I've reviewed your intake form and have a few follow-up questions...", date: "Aug 5" },
  { id: 2, sender: "Paralegal Chen",    snippet: "Please upload your 2022 and 2023 tax returns when you get a chance.",   date: "Aug 4" },
  { id: 3, sender: "Attorney Rivera",   snippet: "Welcome to the Independence Law portal! We're glad to have you.",       date: "Aug 3" },
  { id: 4, sender: "Case Coordinator",  snippet: "Your intake has been assigned to Attorney Rivera.",                     date: "Aug 2" },
  { id: 5, sender: "Independence Law",  snippet: "Your account has been created. Please verify your email to continue.", date: "Aug 1" },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getClientSession();

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-1">
          Client Portal
        </p>
        <h1 className="font-serif text-[clamp(1.5rem,3vw,2rem)] text-navy leading-tight mb-1">
          Command Center
        </h1>
        <p className="text-[0.9375rem] text-text-muted">
          An overview of your case, documents, and messages.
        </p>
      </div>

      {/* ── 2-column grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Card 1: Case Status ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-navy p-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Case Status
            </p>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v18" /><path d="M3 9l4 8" /><path d="M21 9l-4 8" />
              <path d="M3 9h18" /><path d="M7 17H3" /><path d="M21 17h-4" />
            </svg>
          </div>

          {/* Status pill */}
          <div>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
              Intake Under Review
            </span>
          </div>

          <p className="text-lg font-semibold text-slate-800 leading-snug">
            Your case is in progress.
          </p>
          <p className="text-sm text-gray-500">
            Your legal team is reviewing your intake information.
            {session?.email ? (
              <span className="block mt-1 text-xs text-gray-400">Logged in as {session.email}</span>
            ) : null}
          </p>
        </div>

        {/* ── Card 2: Documents ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-navy p-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Documents
            </p>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>

          {/* Document status pill */}
          <div>
            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
              Documents Requested
            </span>
          </div>

          {/* Requested items */}
          <ul className="text-sm text-gray-600 space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b91c1c] shrink-0" />
              2022 Federal Tax Return
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b91c1c] shrink-0" />
              2023 Federal Tax Return
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b91c1c] shrink-0" />
              Recent Bank Statements (last 3 months)
            </li>
          </ul>

          <Link
            href="/dashboard/documents"
            className="mt-auto text-sm font-medium text-[#b91c1c] hover:underline self-start"
          >
            Visit Document Hub →
          </Link>
        </div>

        {/* ── Card 3: Messages (full width) ────────────────────────────── */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-navy p-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Messages
            </p>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>

          {/* Message thread list */}
          <div className="divide-y divide-gray-100">
            {MOCK_MESSAGES.map((msg) => (
              <div key={msg.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{msg.sender}</p>
                  <p className="text-sm text-gray-500 truncate">{msg.snippet}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0 pt-0.5">{msg.date}</span>
              </div>
            ))}
          </div>

          <Link
            href="/dashboard/messages"
            className="mt-auto text-sm font-medium text-[#b91c1c] hover:underline self-start"
          >
            Go to Message Center →
          </Link>
        </div>

      </div>
    </div>
  );
}
