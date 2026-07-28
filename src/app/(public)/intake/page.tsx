import type { Metadata } from 'next';
import Link from 'next/link';
import IntakeWizard from '@/components/intake/IntakeWizard';

export const metadata: Metadata = {
  title: 'Borrower Intake | The Independence Law Firm',
  description: 'Secure borrower intake setup for The Independence Law Firm.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface IntakePageProps {
  searchParams: Promise<{
    token?: string | string[];
  }>;
}

function normalizeToken(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? '';
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const params = await searchParams;
  const token = normalizeToken(params.token);

  if (!token) {
    return <InvalidInvitationLink />;
  }

  return <IntakeWizard token={token} />;
}

function InvalidInvitationLink() {
  return (
    <main className="min-h-dvh bg-bg flex flex-col items-center justify-center px-4 py-12">
      <section className="w-full max-w-[560px] bg-white border border-border rounded-xl shadow-xl p-8 text-center animate-fade-in">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-error-bg text-error">
          <AlertIcon />
        </div>
        <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-2">
          The Independence Law Firm
        </p>
        <h1 className="font-serif text-[clamp(1.5rem,3vw,2rem)] text-navy mb-3">
          Invalid Invitation Link
        </h1>
        <p className="text-[0.9375rem] text-text-muted leading-relaxed mb-6">
          This intake invitation link is missing its secure token. Please use the latest link from your email or contact your legal team for a new invitation.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-navy px-5 py-3 text-[0.9375rem] font-semibold text-white shadow-sm transition-all duration-fast hover:-translate-y-px hover:bg-navy-hover hover:no-underline"
        >
          Go to Portal Sign In
        </Link>
      </section>
    </main>
  );
}

function AlertIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
