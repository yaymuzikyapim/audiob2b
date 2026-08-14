import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/invite", "/api/auth/login", "/api/invite", "/api/mobile/auth/login", "/api/covers"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const session = await getSessionFromRequest(req);

  // Davet sayfaları her zaman erişilebilir — oturum açık olsa bile yönlendirme yok
  if (pathname.startsWith("/invite") || pathname.startsWith("/api/invite")) {
    return NextResponse.next();
  }

  if (isPublic) {
    if (session) {
      const dest = session.role === "SUPER_ADMIN" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL(`/login?from=${pathname}`, req.url));
  }

  if (pathname.startsWith("/admin") && session.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/dashboard") && session.role === "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
