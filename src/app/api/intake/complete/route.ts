import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BORROWER_SESSION_COOKIE_NAMES = ['borrower_session', 'client_token'] as const;

function getCompleteIntakeUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/intake/complete`;
}

function getBorrowerSessionToken(cookieStore: Awaited<ReturnType<typeof cookies>>): string | undefined {
  for (const cookieName of BORROWER_SESSION_COOKIE_NAMES) {
    const token = cookieStore.get(cookieName)?.value;
    if (token) return token;
  }

  return undefined;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = getBorrowerSessionToken(cookieStore);

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const completeIntakeUrl = getCompleteIntakeUrl();
  if (!completeIntakeUrl) {
    console.error('[intake complete proxy] NEXT_PUBLIC_AWS_API_URL is not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const response = await fetch(completeIntakeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error('[intake complete proxy] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
