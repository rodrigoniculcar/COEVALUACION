import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const rol = req.nextauth.token?.rol;

    if (pathname.startsWith("/docente") && rol !== "DOCENTE") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (pathname.startsWith("/estudiante") && rol !== "ESTUDIANTE") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/docente/:path*", "/estudiante/:path*"],
};
