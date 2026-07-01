/**
 * src/app/api/auth/register/route.ts
 *
 * POST /api/auth/register
 *
 * Thin Route Handler that delegates to the registerClient Server Action.
 * This exists so the AuthForm component (which lives on the root `/` page)
 * can POST to `/api/auth/register` via plain fetch — exactly as it did before.
 *
 * The actual backend call and all secret handling lives in:
 *   src/actions/registerClient.ts
 *
 * Security mandate:
 *   - All backend secrets stay in the Server Action (server-side only)
 *   - This route handler never logs or echoes passwords
 *   - Response codes mirror the backend contract (201 / 400 / 409 / 500)
 */

import { NextRequest, NextResponse } from "next/server";
import { registerClient } from "@/actions/registerClient";

// ── POST /api/auth/register ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Request body required." }, { status: 400 });
  }

  const { fullName, name, email, password } = body as Record<string, unknown>;

  // Support both `name` (new) and `fullName` (legacy AuthForm field)
  const resolvedName = (typeof name === "string" ? name : null)
    ?? (typeof fullName === "string" ? fullName : null)
    ?? "";

  if (
    typeof resolvedName !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return NextResponse.json(
      { message: "Missing required fields: name, email, password." },
      { status: 400 }
    );
  }

  // Delegate to the Server Action
  const result = await registerClient({
    name: resolvedName,
    email,
    password,
  });

  if (result.ok) {
    return NextResponse.json(
      {
        message: "Account created. Please check your email to verify your account.",
        emailSent: true,
      },
      { status: 201 }
    );
  }

  // Map ActionResult failure codes back to HTTP
  switch (result.code) {
    case "DUPLICATE_EMAIL":
      return NextResponse.json(
        { message: result.message, code: "EMAIL_EXISTS" },
        { status: 409 }
      );
    case "VALIDATION":
      return NextResponse.json(
        { message: result.message },
        { status: 400 }
      );
    default:
      return NextResponse.json(
        { message: result.message },
        { status: 500 }
      );
  }
}

// ── Block all other HTTP methods ──────────────────────────────────────────────

export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
