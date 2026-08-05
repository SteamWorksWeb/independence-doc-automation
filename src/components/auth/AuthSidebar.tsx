/**
 * src/components/auth/AuthSidebar.tsx
 *
 * Shared brand sidebar for all auth-adjacent pages:
 *   /login, /admin/login, /intake
 *
 * Renders: logo only on the navy + radial-gradient background.
 * No tagline, no headline text, no footer links.
 *
 * Usage — wrap your page content with the exported layout shell:
 *
 *   import { AuthLayout, AuthSidebar } from '@/components/auth/AuthSidebar';
 *
 *   export default function MyPage() {
 *     return (
 *       <AuthLayout>
 *         <AuthSidebar />
 *         <section className={styles.formPanel}>
 *           <MyForm />
 *         </section>
 *       </AuthLayout>
 *     );
 *   }
 */

import styles from './AuthSidebar.module.css';

/** The logo-only left sidebar panel. */
export function AuthSidebar() {
  return (
    <aside className={styles.panel} aria-hidden="true">
      <div className={styles.logo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Liberty" />
      </div>
    </aside>
  );
}

/** Full-page two-column shell. Place <AuthSidebar /> and a form panel inside. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className={styles.root}>{children}</main>;
}

/** The right-side form panel with centering (login pages). */
export function AuthFormPanel({ children }: { children: React.ReactNode }) {
  return <section className={styles.formPanel}>{children}</section>;
}

/** The right-side panel for tall wizard content (intake page). Top-aligned + scrollable. */
export function AuthWizardPanel({ children }: { children: React.ReactNode }) {
  return <section className={styles.wizardPanel}>{children}</section>;
}

export { styles as authStyles };
