import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

const locales = ["tr", "en", "de", "es", "fr", "it", "pt", "ar", "ru", "zh", "ja"];
const defaultLocale = "tr";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
});

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/pricing",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/stripe/webhook",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files and Next.js internals — bypass everything
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") === false && pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Run next-intl middleware first (rewrites / → /tr if default locale)
  const intlResponse = intlMiddleware(request);

  // Strip locale prefix for path checks (e.g. /tr/login → /login)
  const cleanPath = pathname.replace(new RegExp(`^/(${locales.join("|")})/`), "/");

  // Public paths — no auth needed
  if (PUBLIC_PATHS.some((p) => cleanPath.startsWith(p))) {
    return intlResponse;
  }

  // Auth check
  const token = request.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)"],
};
