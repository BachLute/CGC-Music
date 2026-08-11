import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/auth";

// Runs before every matched request, on the server, ahead of any page or
// layout rendering — so there is no page source or client bundle that can
// be inspected to bypass it.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySessionToken(token);

  if (authenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Everything except the login page itself, the login API route, and
    // static assets — protect all other pages and API routes.
    "/((?!login|api/login|_next/static|_next/image|favicon.ico).*)",
  ],
};
