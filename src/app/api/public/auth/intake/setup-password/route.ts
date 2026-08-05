import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const setupPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type JsonRecord = Record<string, unknown>;

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
}

function extractBorrowerEmail(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as JsonRecord;

  for (const key of ['email', 'borrowerEmail', 'clientEmail', 'emailAddress', 'preferred_username', 'username', 'sub']) {
    const email = normalizeEmail(record[key]);
    if (email) return email;
  }

  for (const key of ['borrower', 'client', 'user', 'session', 'profile', 'intakeProfile']) {
    const email = extractBorrowerEmail(record[key]);
    if (email) return email;
  }

  return '';
}

function getBackendUrl(): string | null {
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, '');

  if (!backendBase) {
    console.error('[public/intake/setup-password] Missing NEXT_PUBLIC_AWS_API_URL.');
    return null;
  }

  const backendRoot = backendBase.replace(/\/api\/v1\/?$/, '');
  return `${backendRoot}/api/v1/auth/intake/setup-password`;
}

async function readBackendJson(response: Response): Promise<JsonRecord> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const parsed = await response.json().catch(() => ({}));
    return parsed && typeof parsed === 'object' ? parsed as JsonRecord : {};
  }

  const text = await response.text().catch(() => '');
  return text ? { message: text } : {};
}

function getSetCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie();
  }

  const setCookie = headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = setupPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      {
        message: 'Please check your account setup details.',
        fieldErrors,
      },
      { status: 422 }
    );
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { message: 'Server configuration error.' },
      { status: 503 }
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error('[public/intake/setup-password] Backend request failed:', err);
    return NextResponse.json(
      { message: 'Unable to reach the account setup service. Please try again.' },
      { status: 502 }
    );
  }

  const data = await readBackendJson(backendRes);
  const response = NextResponse.json(data, { status: backendRes.status });
  const borrowerEmail = extractBorrowerEmail(data);

  for (const cookie of getSetCookieHeaders(backendRes.headers)) {
    response.headers.append('Set-Cookie', cookie);
  }

  if (backendRes.ok) {
    if (borrowerEmail) {
      response.cookies.set('borrower_email', borrowerEmail, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    if (data.token && typeof data.token === 'string') {
      response.cookies.set('borrower_session', data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }
  }

  return response;
}

export function GET() {
  return NextResponse.json({ message: 'Method not allowed.' }, { status: 405 });
}
