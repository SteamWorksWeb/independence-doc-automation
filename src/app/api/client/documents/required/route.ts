import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BORROWER_SESSION_COOKIE_NAMES = ["borrower_session", "client_token"] as const;

function getBorrowerSessionToken(cookieStore: Awaited<ReturnType<typeof cookies>>): string | undefined {
  for (const cookieName of BORROWER_SESSION_COOKIE_NAMES) {
    const token = cookieStore.get(cookieName)?.value;
    if (token) return token;
  }

  return undefined;
}

function getRequiredDocumentsUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!base) return null;

  return `${base.replace(/\/+$/, "")}/client/documents/required`;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = getBorrowerSessionToken(cookieStore);

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requiredDocumentsUrl = getRequiredDocumentsUrl();
  if (!requiredDocumentsUrl) {
    console.error("[client documents required proxy] NEXT_PUBLIC_AWS_API_URL is not configured");
    return NextResponse.json({ message: "Server configuration error" }, { status: 503 });
  }

  try {
    const response = await fetch(requiredDocumentsUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("[client documents required proxy] GET error:", err);
    return NextResponse.json(
      { message: "Unable to reach the backend. Please try again." },
      { status: 502 }
    );
  }
}

export function POST() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
