import { NextRequest, NextResponse } from "next/server";

// Next.js bakes `next.config.ts`'s `rewrites()` result into the build-time
// routes manifest — it is not re-evaluated when the standalone server starts,
// so an env var read inside `rewrites()` only ever sees its build-time value
// (typically unset, since the Docker image is built without a backend to
// point at). Middleware runs per request instead, so it is the only place a
// same-origin `/api/*` proxy target can genuinely be resolved at container
// runtime via `API_PROXY_TARGET`.
export function middleware(request: NextRequest): NextResponse {
  const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
  if (!target) {
    return NextResponse.next();
  }
  // `target` must be a bare origin (e.g. http://backend:8000): new URL(path, base)
  // drops any path component of the base, so http://host/prefix would silently lose /prefix.
  const destination = new URL(request.nextUrl.pathname + request.nextUrl.search, target);
  // The backend derives the refresh cookie's `Secure` flag from the browser-facing
  // scheme. Reached over this internal proxy its own socket is plain HTTP, so it can
  // only learn the real scheme from X-Forwarded-Proto — forward it (preferring an
  // upstream TLS proxy's value, falling back to the scheme this request arrived on).
  const proto =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(/:$/, "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-forwarded-proto", proto);
  return NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: "/api/:path*",
};
