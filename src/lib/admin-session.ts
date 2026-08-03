/**
 * src/lib/admin-session.ts
 *
 * Server-only helper: decodes the HttpOnly admin_session cookie and returns
 * the verified JWT payload as a typed session object.
 *
 * USAGE (Server Components / Route Handlers only):
 *
 *   import { getAdminSession } from "@/lib/admin-session";
 *   const session = await getAdminSession();
 *   if (!session) redirect("/admin/login");
 *   if (session.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
 *
 * Role values (match backend Prisma AdminRole enum):
 *   "LAWYER"      — standard staff attorney
 *   "SUPER_ADMIN" — firm owner / platform administrator
 *
 * Security:
 *   - Uses jose (Edge-compatible) for JWT verification — never trust unverified payload
 *   - Secrets loaded from server-side env vars only
 *   - Returns null on ANY verification failure (expired, tampered, missing)
 *   - Never import this file from a client component ("use client")
 */

import { jwtVerify } from "jose";
import { cookies } from "next/headers";

// ── Session shape ─────────────────────────────────────────────────────────────

export type AdminRole = "LAWYER" | "SUPER_ADMIN";

export interface AdminSession {
  /** Admin database ID (sub claim) */
  id: string;
  /** Admin email address */
  email: string;
  /** RBAC role — controls access to SUPER_ADMIN-gated features */
  role: AdminRole;
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Reads and verifies the admin_session JWT from the HttpOnly cookie store.
 * Returns a typed AdminSession on success, or null on any failure.
 *
 * Call from Server Components, Server Actions, or Route Handlers only.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("admin_session");

    if (!sessionCookie?.value) return null;

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[admin-session] JWT_SECRET is not configured.");
      return null;
    }

    const { payload } = await jwtVerify(
      sessionCookie.value,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] }
    );

    // Validate required claims
    const id    = typeof payload.sub   === "string" ? payload.sub   : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    // Backend may send "LAWYER", "SUPER_ADMIN", or legacy "lawyer"/"super_admin"
    const rawRole = typeof payload.role === "string" ? payload.role.toUpperCase() : null;

    if (!id || !email || !rawRole) return null;

    // Normalise to canonical enum values
    const role: AdminRole =
      rawRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : "LAWYER";

    return { id, email, role };
  } catch {
    // Token expired, invalid signature, or any jose error — treat as unauthenticated
    return null;
  }
}

/**
 * Returns true if the given role is allowed to access SUPER_ADMIN-only features.
 */
export function isSuperAdmin(role: AdminRole | undefined | null): boolean {
  return role === "SUPER_ADMIN";
}
