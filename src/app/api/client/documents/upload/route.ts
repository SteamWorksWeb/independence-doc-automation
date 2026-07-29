import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BORROWER_SESSION_COOKIE_NAMES = ["borrower_session", "client_token"] as const;

function getBorrowerSessionToken(cookieStore: Awaited<ReturnType<typeof cookies>>): string | undefined {
  for (const cookieName of BORROWER_SESSION_COOKIE_NAMES) {
    const token = cookieStore.get(cookieName)?.value;
    if (token) return token;
  }

  return undefined;
}

function getUploadDocumentsUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_AWS_API_URL;
  if (!base) return null;

  return `${base.replace(/\/+$/, "")}/client/documents/upload`;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = getBorrowerSessionToken(cookieStore);

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const uploadDocumentsUrl = getUploadDocumentsUrl();
  if (!uploadDocumentsUrl) {
    console.error("[client documents upload proxy] NEXT_PUBLIC_AWS_API_URL is not configured");
    return NextResponse.json({ message: "Server configuration error" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form upload." }, { status: 400 });
  }

  const file = formData.get("file");
  const documentType = formData.get("documentType");

  if (!file || typeof file === "string") {
    return NextResponse.json({ message: "A file is required." }, { status: 422 });
  }

  if (!documentType || typeof documentType !== "string") {
    return NextResponse.json({ message: "A document type is required." }, { status: 422 });
  }

  try {
    const response = await fetch(uploadDocumentsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : { message: await response.text().catch(() => "") };

    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("[client documents upload proxy] POST error:", err);
    return NextResponse.json(
      { message: "Unable to upload the document. Please try again." },
      { status: 502 }
    );
  }
}

export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
