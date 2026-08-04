/**
 * src/app/api/intake/snapshot/route.ts
 *
 * POST /api/intake/snapshot
 *
 * Server-side proxy for:
 *   POST /api/v1/intake/snapshot
 *
 * Why a proxy?
 *   The client's JWT lives in an HttpOnly cookie ("client_token" or
 *   "borrower_session") that is invisible to browser JavaScript. This Route
 *   Handler runs on the Next.js server, reads the cookie via next/headers,
 *   and forwards the request to the Render backend with a Bearer Authorization
 *   header. The intake wizard component POSTs to THIS route — never directly
 *   to the backend.
 *
 * Cookie names (checked in order):
 *   "client_token"      — set by POST /api/auth/login (current)
 *   "borrower_session"  — legacy alias (kept for backwards compat)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CLIENT_COOKIE_NAMES = ['client_token', 'borrower_session'] as const;

function getBackendUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, '');
  if (!base) return null;
  // NEXT_PUBLIC_AWS_API_URL is set to https://<host>/api/v1
  // The snapshot endpoint lives at /api/v1/intake/snapshot
  return `${base}/intake/snapshot`;
}

function getClientToken(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): string | undefined {
  for (const name of CLIENT_COOKIE_NAMES) {
    const value = cookieStore.get(name)?.value;
    if (value) return value;
  }
  return undefined;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Read the client session cookie ──────────────────────────────────────
  const cookieStore = await cookies();
  const token = getClientToken(cookieStore);

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Resolve backend URL ─────────────────────────────────────────────────
  const targetUrl = getBackendUrl();
  if (!targetUrl) {
    console.error(
      '[proxy/intake/snapshot] NEXT_PUBLIC_AWS_API_URL is not configured.'
    );
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { status: 503 }
    );
  }

  // ── 3. Parse the incoming body ─────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // ── 4. Forward POST to backend ─────────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (err) {
    console.error('[proxy/intake/snapshot] Network error reaching backend:', err);
    return NextResponse.json(
      { error: 'Unable to reach the backend. Please try again.' },
      { status: 502 }
    );
  }

  // ── 5. Relay backend response verbatim ────────────────────────────────────
  let data: unknown;
  const text = await backendRes.text();

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error: text || backendRes.statusText || 'Backend returned a non-JSON response.',
    };
  }

  return NextResponse.json(data, { status: backendRes.status });
}
