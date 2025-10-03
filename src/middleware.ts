import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/i18n/config';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true
});

// Protected routes that require authentication (web routes only)
const protectedRoutes = [
  '/dashboard',
  '/files',
  '/quiz'
];

const authMiddleware = withAuth(
  function middleware(req) {
    return intlMiddleware(req);
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Remove locale from pathname for route checking
        const localePattern = `/(${locales.join('|')})`;
        const pathWithoutLocale = pathname.replace(new RegExp(`^${localePattern}`), '');

        // Check if it's a protected route
        const isProtected = protectedRoutes.some(route =>
          pathWithoutLocale.startsWith(route)
        );

        // If it's a protected route, require authentication
        if (isProtected) {
          return !!token;
        }

        return true;
      },
    },
    pages: {
      signIn: '/auth/signin',
      error: '/auth/signin',
    }
  }
);

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Remove locale from pathname for route checking
  const localePattern = `/(${locales.join('|')})`;
  const pathWithoutLocale = pathname.replace(new RegExp(`^${localePattern}`), '');

  // Check if it's a protected route
  const isProtectedPath = protectedRoutes.some(route =>
    pathWithoutLocale.startsWith(route)
  );

  // Use auth middleware for protected routes
  if (isProtectedPath) {
    // Type assertion to handle the middleware function type
    const middleware = authMiddleware as (req: NextRequest) => ReturnType<typeof intlMiddleware>;
    return middleware(req);
  }

  // For public routes, just apply intl middleware
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    '/',
    '/(ar|en)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};