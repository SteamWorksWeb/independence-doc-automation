/**
 * src/app/admin/documents/page.tsx
 *
 * Global Documents Archive — Admin Dashboard
 *
 * Server Component: fetches all documents from the backend using the
 * admin_session cookie, then passes the data to a client-side table
 * component that handles text filtering.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import DocumentsTable from "./DocumentsTable";

export const metadata: Metadata = {
  title: "Documents Archive | Independence Law Admin",
  description:
    "Global archive of all documents uploaded across every client case at The Independence Law Firm.",
};

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentRecord {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedByRole: "lawyer" | "client" | string;
  createdAt: string;
  client: {
    id: string;
    name: string;
  };
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function fetchDocuments(): Promise<{ docs: DocumentRecord[]; error: string | null }> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    return { docs: [], error: "No admin session found. Please log in again." };
  }

  const apiBase = process.env.NEXT_PUBLIC_AWS_API_URL ?? "";

  try {
    const res = await fetch(`${apiBase}/api/v1/admin/documents`, {
      headers: {
        Cookie: `admin_session=${session}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { docs: [], error: `API error ${res.status}: ${text}` };
    }

    const json = await res.json();
    // Support both { documents: [] } and a bare array
    const docs: DocumentRecord[] = Array.isArray(json)
      ? json
      : (json.documents ?? json.data ?? []);

    return { docs, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { docs: [], error: `Failed to reach API: ${msg}` };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DocumentsPage() {
  const { docs, error } = await fetchDocuments();

  return (
    <main className="flex-1 p-6 md:p-8 overflow-auto bg-slate-50 min-h-screen">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-navy/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a2744"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <h1 className="text-2xl font-bold text-navy tracking-tight font-serif">
            Documents Archive
          </h1>
        </div>
        <p className="text-sm text-slate-500 ml-[52px]">
          Global view of every document uploaded across all client cases.
        </p>
      </div>

      {/* ── Error state ─────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700"
        >
          <svg
            className="mt-0.5 shrink-0"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── Table (client component handles filtering) ──────────── */}
      <DocumentsTable docs={docs} />
    </main>
  );
}
