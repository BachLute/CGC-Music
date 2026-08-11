import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, createSessionToken, verifyPassword } from "../../../lib/auth";

// The only place APP_PASSWORD is ever read or compared. The password never
// reaches middleware or the client — only a signed session token does.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const password = (body as { password?: unknown })?.password;
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  let isValid: boolean;
  try {
    isValid = await verifyPassword(password);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Server is not configured. Set the APP_PASSWORD environment variable." },
      { status: 500 }
    );
  }

  if (!isValid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // No maxAge: this is a browser-session cookie. It survives page loads
    // and navigation but clears when the browser closes.
  });
  return response;
}
