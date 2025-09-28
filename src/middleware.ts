import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith("/files") ||
            req.nextUrl.pathname.startsWith("/quiz")) {
          return !!token;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/files/:path*",
    "/quiz/:path*",
    "/api/files/:path*",
    "/api/quiz/:path*",
  ],
};