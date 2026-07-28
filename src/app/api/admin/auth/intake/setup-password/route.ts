import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CLIENT_COOKIE_NAME = 'client_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

const setupPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type JsonRecord = Record<string, unknown>;

function getBackendConfig(): { targetUrls: string[]; apiSecret: string } | null {
  const backendBase = process.env.NEXT_PUBLIC_AWS_API_URL?.replace(/\/+$/, '');
  const apiSecret = process.env.AWS_API_SECRET;

  if (!backendBase || !apiSecret) {
    console.error(
      '[intake/setup-password] Missing NEXT_PUBLIC_AWS_API_URL or AWS_API_SECRET.'
    );
    return null;
  }

  const backendRoot = backendBase.replace(/\/api\/v1\/?$/, '');
  const targetUrls = [
    `${backendRoot}/api/admin/auth/intake/setup-password`,
    `${backendBase}/admin/auth/intake/setup-password`,
  ];

  return {
    targetUrls: Array.from(new Set(targetUrls)),
    apiSecret,
  };
}

function extractJwt(data: JsonRecord): string | null {
  if (typeof data.token === 'string') return data.token;
  if (typeof data.jwt === 'string') return data.jwt;
  if (typeof data.accessToken === 'string') return data.accessToken;
  if (typeof data.sessionToken === 'string') return data.sessionToken;

  const session = data.session;
  if (session && typeof session === 'object' && 'token' in session) {
    const sessionToken = (session as JsonRecord).token;
    if (typeof sessionToken === 'string') return sessionToken;
  }

  return null;
}

function publicResponseData(data: JsonRecord): JsonRecord {
  const {
    token: _token,
    jwt: _jwt,
    accessToken: _accessToken,
    sessionToken: _sessionToken,
    session: _session,
    ...safeData
  } = data;

  return safeData;
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

  const config = getBackendConfig();
  if (!config) {
    return NextResponse.json(
      { message: 'Server configuration error.' },
      { status: 503 }
    );
  }

  let backendRes: Response | null = null;
  let data: JsonRecord = {};

  for (const targetUrl of config.targetUrls) {
    try {
      backendRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${config.apiSecret}`,
        },
        body: JSON.stringify(parsed.data),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      data = await readBackendJson(backendRes);
    } catch (err) {
      console.error('[intake/setup-password] Backend request failed:', err);
      return NextResponse.json(
        { message: 'Unable to reach the account setup service. Please try again.' },
        { status: 502 }
      );
    }

    if (backendRes.status !== 404) {
      break;
    }
  }

  if (!backendRes) {
    return NextResponse.json(
      { message: 'Account setup service is unavailable.' },
      { status: 502 }
    );
  }

  if (!backendRes.ok) {
    const message =
      typeof data.message === 'string' ? data.message :
      typeof data.error === 'string' ? data.error :
      'Unable to set up this borrower account.';

    return NextResponse.json({ message }, { status: backendRes.status });
  }

  const jwt = extractJwt(data);
  if (!jwt) {
    console.error('[intake/setup-password] Backend success response did not include a JWT.');
    return NextResponse.json(
      { message: 'Account setup succeeded, but no session was returned.' },
      { status: 502 }
    );
  }

  const response = NextResponse.json(
    {
      ok: true,
      ...publicResponseData(data),
    },
    { status: 200 }
  );

  response.cookies.set(CLIENT_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}

export function GET() {
  return NextResponse.json({ message: 'Method not allowed.' }, { status: 405 });
}
