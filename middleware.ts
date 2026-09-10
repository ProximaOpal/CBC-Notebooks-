import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/telemetry")) {
    const headers = new Headers(req.headers);
    headers.delete("x-forwarded-for");
    headers.delete("x-real-ip");
    headers.set("x-privacy-anonymized", "1");
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/telemetry/:path*", "/api/privacy/:path*"],
};
