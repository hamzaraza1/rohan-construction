import { NextResponse, type NextRequest } from "next/server";

// Fast first gate: no session cookie → go to the login page.
// The cookie is fully validated against the database in every page, server
// action and route handler (see src/lib/auth); this is NOT the security boundary.
const PUBLIC_PATHS = ["/login", "/api/health"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (!req.cookies.has("rc_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
