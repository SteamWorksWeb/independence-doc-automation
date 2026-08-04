import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const BORROWER_SESSION_COOKIE_NAMES = ['borrower_session', 'client_token'] as const;
const BORROWER_EMAIL_COOKIE_NAME = 'borrower_email';

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
}

function extractEmailFromPayload(payload: Record<string, unknown>): string {
  for (const key of ['email', 'borrowerEmail', 'clientEmail', 'emailAddress', 'preferred_username', 'username', 'sub']) {
    const email = normalizeEmail(payload[key]);
    if (email) return email;
  }

  return '';
}

export async function GET() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('[borrower-session] JWT_SECRET is not configured.');
    return NextResponse.json({ message: 'Server configuration error.' }, { status: 503 });
  }

  const cookieStore = await cookies();
  const cookieEmail = normalizeEmail(cookieStore.get(BORROWER_EMAIL_COOKIE_NAME)?.value);
  if (cookieEmail) {
    return NextResponse.json({ email: cookieEmail }, { status: 200 });
  }

  const secret = new TextEncoder().encode(jwtSecret);

  for (const cookieName of BORROWER_SESSION_COOKIE_NAMES) {
    const token = cookieStore.get(cookieName)?.value;
    if (!token) continue;

    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
      return NextResponse.json({ email: extractEmailFromPayload(payload) }, { status: 200 });
    } catch {
      // Try the next supported borrower session cookie.
    }
  }

  return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
}
