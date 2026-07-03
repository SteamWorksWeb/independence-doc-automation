/**
 * src/app/dashboard/page.tsx
 *
 * Client Dashboard — Conditional Rendering Gateway
 *
 * Migrated from CSS Modules → Tailwind CSS (Phase 2).
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import IntakeWizard from "@/components/intake/IntakeWizard";

export const metadata: Metadata = {
  title: "My Dashboard",
};

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntakeProfile {
  isCompleted: boolean;
  [key: string]: unknown;
}

// ── Fetch intake status ───────────────────────────────────────────────────────

async function fetchIntakeStatus(): Promise<{
  profile: IntakeProfile | null;
  error: string | null;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get("client_token")?.value;

  if (!token) {
    console.error("[dashboard] No client_token cookie found.");
    return { profile: null, error: "Unauthorized: No active session." };
  }

  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!backendBase) {
    console.error("[dashboard] NEXT_PUBLIC_AWS_API_URL is undefined.");
    return { profile: null, error: "Server configuration error." };
  }

  const targetUrl = `${backendBase}/intake`;
  console.log(`[dashboard] Fetching intake profile: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    console.log(`[dashboard] Backend responded: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(unreadable)");
      console.error(`[dashboard] Backend returned ${res.status}: ${errorText.slice(0, 300)}`);
      return { profile: null, error: "Failed to load profile. Please try again." };
    }

    const data = await res.json();
    const profile: IntakeProfile | null = data.intakeProfile ?? null;
    console.log(`[dashboard] Intake profile loaded. isCompleted: ${profile?.isCompleted ?? "null"}`);
    return { profile, error: null };
  } catch (err) {
    console.error("[dashboard] FETCH EXCEPTION:", err);
    return {
      profile: null,
      error: `Network error: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { profile, error } = await fetchIntakeStatus();

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="flex flex-col items-center text-center py-16 px-6 gap-3">
          <div className="w-[68px] h-[68px] rounded-full bg-error-bg text-error flex items-center justify-center mb-1">
            <AlertIcon />
          </div>
          <p className="font-serif text-[1.0625rem] font-bold text-text-primary">Unable to Load Dashboard</p>
          <p className="text-[0.9rem] text-text-muted max-w-[380px] leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // ── State A: Intake not complete → show the wizard ──────────────────────────
  if (!profile || !profile.isCompleted) {
    return <IntakeWizard />;
  }

  // ── State B: Intake complete → show the dashboard home ──────────────────────
  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* ── Welcome header ────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy leading-[1.1]">
          Welcome to Your Portal
        </h1>
        <p className="text-[0.9375rem] text-text-muted leading-relaxed">
          Your intake questionnaire has been submitted. Here's an overview of your case status.
        </p>
      </div>

      {/* ── Status cards ──────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 max-[768px]:grid-cols-1">
        <div className="bg-white border border-border rounded-lg p-6 flex flex-col gap-2.5 shadow-sm transition-[box-shadow,transform] duration-200 ease-in-out hover:shadow-md hover:-translate-y-0.5">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-success-bg text-success">
            <CheckCircleIcon />
          </div>
          <h2 className="font-serif text-base font-bold text-navy">Intake Submitted</h2>
          <p className="text-[0.8125rem] text-text-muted leading-[1.55]">
            Your DOJ Student Loan Questionnaire has been received and is under attorney review.
          </p>
          <span className="inline-flex items-center gap-[5px] py-1 px-2.5 rounded-full text-xs font-semibold w-fit bg-success-bg text-success">
            <DotIcon /> Complete
          </span>
        </div>

        <div className="bg-white border border-border rounded-lg p-6 flex flex-col gap-2.5 shadow-sm transition-[box-shadow,transform] duration-200 ease-in-out hover:shadow-md hover:-translate-y-0.5">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-[#eff4ff] text-[#2563eb]">
            <FileSearchIcon />
          </div>
          <h2 className="font-serif text-base font-bold text-navy">Case Review</h2>
          <p className="text-[0.8125rem] text-text-muted leading-[1.55]">
            Your attorney is reviewing your financial information and preparing the eligibility analysis.
          </p>
          <span className="inline-flex items-center gap-[5px] py-1 px-2.5 rounded-full text-xs font-semibold w-fit bg-[#eff4ff] text-[#2563eb]">
            <DotIcon /> In Progress
          </span>
        </div>

        <div className="bg-white border border-border rounded-lg p-6 flex flex-col gap-2.5 shadow-sm transition-[box-shadow,transform] duration-200 ease-in-out hover:shadow-md hover:-translate-y-0.5">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-warning-bg text-warning">
            <DocumentIcon />
          </div>
          <h2 className="font-serif text-base font-bold text-navy">Documents</h2>
          <p className="text-[0.8125rem] text-text-muted leading-[1.55]">
            Your attorney may request additional documents. You'll be notified via email.
          </p>
          <span className="inline-flex items-center gap-[5px] py-1 px-2.5 rounded-full text-xs font-semibold w-fit bg-warning-bg text-warning">
            <DotIcon /> Awaiting
          </span>
        </div>
      </div>

      {/* ── What to expect ────────────────────────────────── */}
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="py-5 px-6 border-b border-border">
          <h2 className="font-serif text-[1.0625rem] font-bold text-navy m-0">What Happens Next</h2>
        </div>
        <div className="py-5 px-6">
          <ol className="flex flex-col gap-4 list-none m-0 p-0">
            <li className="flex gap-3.5 items-start">
              <span className="w-7 h-7 rounded-full bg-navy text-white font-sans text-xs font-bold flex items-center justify-center shrink-0 mt-px">1</span>
              <span className="text-[0.9rem] text-text-secondary leading-[1.55]">
                <span className="font-semibold text-text-primary">Attorney Review</span> — Your attorney will review your questionnaire responses and financial data within 2-3 business days.
              </span>
            </li>
            <li className="flex gap-3.5 items-start">
              <span className="w-7 h-7 rounded-full bg-navy text-white font-sans text-xs font-bold flex items-center justify-center shrink-0 mt-px">2</span>
              <span className="text-[0.9rem] text-text-secondary leading-[1.55]">
                <span className="font-semibold text-text-primary">Eligibility Analysis</span> — A Brunner Test analysis will determine your eligibility for student loan discharge under 11 U.S.C. § 523(a)(8).
              </span>
            </li>
            <li className="flex gap-3.5 items-start">
              <span className="w-7 h-7 rounded-full bg-navy text-white font-sans text-xs font-bold flex items-center justify-center shrink-0 mt-px">3</span>
              <span className="text-[0.9rem] text-text-secondary leading-[1.55]">
                <span className="font-semibold text-text-primary">Strategy Call</span> — Your attorney will schedule a consultation to discuss the results and outline next steps for your case.
              </span>
            </li>
            <li className="flex gap-3.5 items-start">
              <span className="w-7 h-7 rounded-full bg-navy text-white font-sans text-xs font-bold flex items-center justify-center shrink-0 mt-px">4</span>
              <span className="text-[0.9rem] text-text-secondary leading-[1.55]">
                <span className="font-semibold text-text-primary">Filing</span> — If you qualify, your attorney will prepare and file the adversary proceeding on your behalf.
              </span>
            </li>
          </ol>
        </div>
      </div>

      {/* ── Trust footer ──────────────────────────────────── */}
      <div className="flex items-center justify-center gap-5 py-4 text-xs text-text-muted max-[640px]:flex-col max-[640px]:gap-2">
        <span className="inline-flex items-center gap-[5px]">
          <LockIcon /> 256-bit Encrypted
        </span>
        <span className="text-border max-[640px]:hidden" aria-hidden>•</span>
        <span className="inline-flex items-center gap-[5px]">
          <ShieldIcon /> Attorney-Client Privilege
        </span>
        <span className="text-border max-[640px]:hidden" aria-hidden>•</span>
        <span className="inline-flex items-center gap-[5px]">
          <ClockIcon /> Response within 48 hours
        </span>
      </div>
    </div>
  );
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

function AlertIcon() {
  return (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>);
}

function CheckCircleIcon() {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>);
}

function FileSearchIcon() {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><circle cx="11" cy="15" r="3" /><line x1="13.5" y1="17" x2="16" y2="19.5" /></svg>);
}

function DocumentIcon() {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>);
}

function DotIcon() {
  return (<svg width="6" height="6" aria-hidden><circle cx="3" cy="3" r="3" fill="currentColor" opacity="0.8" /></svg>);
}

function LockIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>);
}

function ShieldIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
}

function ClockIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
}
