import { NextRequest, NextResponse } from "next/server";
import {
  IMPERSONATION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  verifyImpersonationToken,
  verifySessionToken,
} from "@/lib/auth/token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await verifySessionToken(sessionToken) : null;

  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Acesso restrito a administradores." },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL("/painel", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/api/painel" || pathname.startsWith("/api/painel/")) {
    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (session.role === "admin") {
      const impToken = request.cookies.get(IMPERSONATION_COOKIE_NAME)?.value;
      const imp = impToken ? await verifyImpersonationToken(impToken) : null;
      if (!imp || imp.adminId !== session.sub) {
        return NextResponse.json(
          { error: "Use o painel administrativo ou entre como lojista." },
          { status: 403 },
        );
      }
    }
    return NextResponse.next();
  }

  if (pathname === "/painel" || pathname.startsWith("/painel/")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.role === "admin") {
      const impToken = request.cookies.get(IMPERSONATION_COOKIE_NAME)?.value;
      const imp = impToken ? await verifyImpersonationToken(impToken) : null;
      if (!imp || imp.adminId !== session.sub) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
    return NextResponse.next();
  }

  if (pathname === "/login" && session) {
    if (session.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.redirect(new URL("/painel", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/painel",
    "/painel/:path*",
    "/api/painel",
    "/api/painel/:path*",
    "/login",
  ],
};
