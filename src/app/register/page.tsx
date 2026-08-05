/**
 * src/app/register/page.tsx
 *
 * /register is no longer in use. Borrower account creation now happens
 * entirely through the /intake flow (invitation-only, token-gated).
 *
 * Hard redirect to /login so old bookmarks or links don't 404.
 */

import { redirect } from "next/navigation";

export default function RegisterPage() {
  redirect("/login");
}
