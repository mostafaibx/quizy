import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { AuthenticatedUser, AuthResult } from '@/types/auth.types';

// Cache for session validation to avoid repeated token verification
const sessionCache = new Map<string, { user: AuthenticatedUser; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

/**
 * Lazy cleanup of expired cache entries
 * Called during validateSession to remove stale entries
 */
function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of sessionCache.entries()) {
    if (value.expiry < now) {
      sessionCache.delete(key);
    }
  }
}

/**
 * Extracts a cache key from the request for session caching
 */
function getCacheKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  const cookies = request.headers.get('cookie');

  if (authHeader) {
    return `auth:${authHeader.substring(0, 50)}`;
  }

  if (cookies) {
    // Extract session token from cookies
    const tokenMatch = cookies.match(/(__Secure-)?next-auth\.session-token=([^;]+)/);
    return tokenMatch ? `session:${tokenMatch[2]?.substring(0, 50)}` : null;
  }

  return null;
}

/**
 * Validates the session token from the request
 * @param request - NextRequest object
 * @param useCache - Whether to use session caching (default: true)
 * @returns Promise<AuthResult> - Authentication result with user data or error
 */
export async function validateSession(request: NextRequest, useCache: boolean = true): Promise<AuthResult> {
  try {
    // Lazy cleanup of expired cache entries
    if (useCache) {
      cleanupExpiredCache();
    }

    // Check cache first if enabled
    if (useCache) {
      const cacheKey = getCacheKey(request);
      if (cacheKey) {
        const cached = sessionCache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return {
            success: true,
            user: cached.user,
          };
        }
      }
    }

    // Get environment variables with better error handling
    let secret: string | undefined;
    let nodeEnv: string | undefined;

    try {
      const context = await getCloudflareContext({ async: true });
      secret = process.env.NEXTAUTH_SECRET;
      nodeEnv = context.env.NODE_ENV;
    } catch (error) {
      console.error('Failed to get Cloudflare context:', error);
      console.warn('Failed to get Cloudflare context, using process.env fallback');
    }

    // Fallback to process.env
    if (!secret) {
      secret = process.env.NEXTAUTH_SECRET;
      nodeEnv = process.env.NODE_ENV;
    }

    if (!secret) {
      console.error('NEXTAUTH_SECRET not found in environment');
      return {
        success: false,
        error: 'Authentication configuration error',
        code: 'CONFIG_ERROR',
      };
    }

    // Get the token from the request cookies
    const token = await getToken({
      req: request,
      secret,
      secureCookie: nodeEnv === 'production',
    });

    if (!token) {
      return {
        success: false,
        error: 'No valid authentication token found',
        code: 'NO_TOKEN',
      };
    }

    // Comprehensive token validation
    if (!token.sub || !token.email) {
      return {
        success: false,
        error: 'Invalid token structure',
        code: 'INVALID_TOKEN',
      };
    }

    const exp1000 = token.exp as number;
    // Check token expiry explicitly
    if (token.exp && exp1000 < Date.now()) {
      return {
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      };
    }

    // Extract user information from token with validation
    const user: AuthenticatedUser = {
      id: String(token.sub),
      email: String(token.email),
      name: token.name ? String(token.name) : undefined,
      image: token.picture ? String(token.picture) : undefined,
      role: token.role ? String(token.role) : undefined,
      permissions: Array.isArray(token.permissions)
        ? token.permissions.map(String)
        : undefined,
    };

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      return {
        success: false,
        error: 'Invalid email format in token',
        code: 'INVALID_EMAIL',
      };
    }

    // Cache the successful result
    if (useCache) {
      const cacheKey = getCacheKey(request);
      if (cacheKey) {
        sessionCache.set(cacheKey, {
          user,
          expiry: Date.now() + CACHE_TTL,
        });
      }
    }

    return {
      success: true,
      user,
    };
  } catch (error) {
    // Log error details for debugging but don't expose them
    console.error('Session validation error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
    });

    return {
      success: false,
      error: 'Authentication validation failed',
      code: 'VALIDATION_ERROR',
    };
  }
}

/**
 * Gets the authenticated user from the request or throws an error
 * @param request - NextRequest object
 * @returns Promise<AuthenticatedUser> - Authenticated user data
 * @throws Error if authentication fails
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser> {
  const authResult = await validateSession(request);

  if (!authResult.success || !authResult.user) {
    const error = new Error(authResult.error || 'Authentication required');
    // Attach the error code for better error handling
    (error as Error & { code?: string }).code = authResult.code;
    throw error;
  }

  return authResult.user;
}

/**
 * Checks if the request has a valid session
 * @param request - NextRequest object
 * @returns Promise<boolean> - True if authenticated, false otherwise
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const authResult = await validateSession(request);
  return authResult.success;
}

/**
 * Checks if user has required role
 * @param user - Authenticated user
 * @param requiredRole - Required role
 * @returns boolean - True if user has required role
 */
export function hasRole(user: AuthenticatedUser, requiredRole: string): boolean {
  return user.role === requiredRole || user.role === 'admin';
}

/**
 * Checks if user has required permission
 * @param user - Authenticated user
 * @param requiredPermission - Required permission
 * @returns boolean - True if user has required permission
 */
export function hasPermission(user: AuthenticatedUser, requiredPermission: string): boolean {
  if (user.role === 'admin')
    return true; // Admins have all permissions
  return user.permissions?.includes(requiredPermission) || false;
}

/**
 * Clears session cache for a specific request
 * @param request - NextRequest object
 */
export function clearSessionCache(request: NextRequest): void {
  const cacheKey = getCacheKey(request);
  if (cacheKey) {
    sessionCache.delete(cacheKey);
  }
}

/**
 * Clears all session cache
 */
export function clearAllSessionCache(): void {
  sessionCache.clear();
}
