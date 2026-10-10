import { NextResponse, type NextRequest } from "next/server";
import { config as appConfig } from "@/lib/config";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

/**
 * Runs before every matched request. Two cheap, optimistic jobs only -- the
 * real authorization happens in each page/route via src/lib/auth/context.ts,
 * which validates the session against the database:
 *
 * 1. Send signed-out visitors to /login (pages) or a 401 (API) without
 *    rendering anything.
 * 2. Reject cross-site state-changing API requests (CSRF defence in depth on
 *    top of SameSite=Lax cookies).
 */

const PUBLIC_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password", "/invite"];
const PUBLIC_API = ["/api/auth/", "/api/health"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  // No Origin header: not a browser cross-origin request (curl, server-to-server).
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    if (originUrl.origin === new URL(appConfig.appUrl).origin) return true;
    const host = (appConfig.trustProxy && request.headers.get("x-forwarded-host")) || request.headers.get("host");
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && request.method !== "GET" && request.method !== "HEAD" && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request blocked", code: "csrf" }, { status: 403 });
  }

  if (!isPublic(pathname) && !request.cookies.get(SESSION_COOKIE)?.value) {
    if (isApi) {
      return NextResponse.json({ error: "Please sign in.", code: "unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's build assets and the static files in public/.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|icon-|apple-touch-icon).*)",
  ],
};
