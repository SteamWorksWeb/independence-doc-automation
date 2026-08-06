/**
 * src/app/dashboard/page.tsx
 *
 * Client Dashboard — Command Center
 *
 * Read-only overview of the client's case status, documents, and messages.
 * Authentication and session validation are handled by middleware (src/middleware.ts)
 * and the ClientShell layout — this page assumes the user is authenticated.
 *
 * The legacy IntakeWizard conditional render has been removed.
 * The intake flow lives at /onboarding (IntakeWizard component is unchanged there).
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Dashboard",
};

export const maxDuration = 60;

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      <h1 className="text-2xl font-bold text-slate-900">Client Command Center</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 — Case Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-2">Case Status</h2>
          <p className="text-sm text-slate-500">Your intake is under review.</p>
        </div>

        {/* Card 2 — Recent Documents */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-2">Recent Documents</h2>
          <p className="text-sm text-slate-500">No documents uploaded yet.</p>
        </div>

        {/* Card 3 — Messages */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-2">Messages</h2>
          <p className="text-sm text-slate-500">No new messages.</p>
        </div>
      </div>
    </div>
  );
}
