import { NextResponse, type NextRequest } from "next/server";

function hostWithoutPort(request: NextRequest) {
  return (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
}

function hostMatches(host: string, expected: string | undefined, prefix: string) {
  const normalizedExpected = expected?.toLowerCase();
  return host === normalizedExpected || host.startsWith(`${prefix}.`);
}

export default function proxy(request: NextRequest) {
  const host = hostWithoutPort(request);
  const { pathname } = request.nextUrl;
  const isAdminHost = hostMatches(host, process.env.ADMIN_APP_HOST ?? "admin.freightcontrol.com", "admin");
  const isCompanyHost = hostMatches(host, process.env.COMPANY_APP_HOST ?? "app.freightcontrol.com", "app");
  const isPortalHost = hostMatches(host, process.env.PORTAL_APP_HOST ?? "portal.freightcontrol.com", "portal");

  if (isAdminHost && (pathname.startsWith("/dashboard") || pathname.startsWith("/portal"))) {
    return NextResponse.redirect(new URL("/platform", request.url));
  }

  if (isCompanyHost && (pathname.startsWith("/platform") || pathname.startsWith("/portal"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPortalHost && (pathname.startsWith("/dashboard") || pathname.startsWith("/platform"))) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/platform/:path*", "/portal/:path*"],
};
