import type { Metadata } from 'next';
import IntakeWizard from '@/components/intake/IntakeWizard';

export const metadata: Metadata = {
  title: 'Client Intake | The Independence Law Firm',
  description:
    'Complete your secure client intake form. Your information is protected ' +
    'by attorney-client privilege and 256-bit encryption.',
  robots: { index: false, follow: false }, // Keep intake forms out of search
};

export default function OnboardingPage() {
  return <IntakeWizard />;
}
