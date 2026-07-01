// =============================================================================
// THE INDEPENDENCE LAW FIRM — INTAKE API PROXY
// src/app/api/intake/route.ts
//
// This proxy is the ONLY correct way to call the Render backend's
// /api/v1/intake endpoint from the client-side wizard.
//
// Why a proxy?
//   The client_token is stored as an HttpOnly cookie.
//   Browser JS cannot read HttpOnly cookies, so the wizard component
//   cannot attach it to a fetch() call directly.
//   This server-side route reads it from the cookie jar and forwards it
//   as a Bearer token in the Authorization header to Render.
//
// Routes:
//   POST /api/intake  — Forward intake payload to Render (create/update)
//   GET  /api/intake  — Forward intake fetch to Render (retrieve profile)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL as string;

// ── POST /api/intake ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('client_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error('[intake proxy] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/intake ──────────────────────────────────────────────────────────
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('client_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/intake`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error('[intake proxy] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
