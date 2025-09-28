import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import type { HonoEnv } from '@/types/cloudflare';
import type { AuthenticatedUser, AuthConfig } from '@/types/auth.types';

/**
 * NextAuth session validation middleware for Hono
 * Note: In Cloudflare Workers, we need to validate the session using the request context
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const requestId = c.get('requestId') ?? 'unknown';

  try {
    const { validateSession } = await import('@/utils/auth');

    // Convert Hono request to NextRequest for session validation
    let nextRequest: import('next/server').NextRequest;
    try {
      const { NextRequest } = await import('next/server');
      nextRequest = new NextRequest(c.req.raw);
    } catch {
      // Fallback for non-Next.js runtimes (e.g. Cloudflare Workers)
      nextRequest = c.req.raw as unknown as import('next/server').NextRequest;
    }

    const authResult = await validateSession(nextRequest);
    if (!authResult.success || !authResult.user) {
      throw new HTTPException(401, { message: 'NO_SESSION' });
    }

    // Map validated user to internal type
    const { user: validatedUser } = authResult;
    const user: AuthenticatedUser = {
      id: validatedUser.id,
      email: validatedUser.email,
      name: validatedUser.name,
      image: validatedUser.image,
      role: validatedUser.role,
      permissions: validatedUser.permissions,
    };

    c.set('user', user);
    await next();
  } catch (error) {
    // Log error with request ID for correlation
    console.error(`Auth error [${requestId}]:`, error);

    if (error instanceof HTTPException) {
      // Clean error for client - don't leak internal details
      throw new HTTPException(error.status, {
        message: error.message === 'NO_SESSION' ? 'NO_SESSION' : 'UNAUTHORIZED',
      });
    }

    // Generic error - don't leak internals
    throw new HTTPException(500, { message: 'AUTH_ERROR' });
  }
});

/**
 * Higher-order middleware factory for role and permission checking
 */
export function requireAuth(config?: AuthConfig) {
  return createMiddleware(async (c, next) => {
    const requestId = c.get('requestId') ?? 'unknown';

    try {
      // First run the basic auth middleware
      await authMiddleware(c, next);

      const user = c.get('user');
      if (!user) {
        throw new HTTPException(401, { message: 'NO_SESSION' });
      }

      // Check role requirements
      if (config?.requiredRole && user.role !== config.requiredRole) {
        console.error(`Role check failed [${requestId}]: Required ${config.requiredRole}, got ${user.role}`);
        throw new HTTPException(403, { message: 'FORBIDDEN' });
      }

      // Check permission requirements
      if (config?.requiredPermissions && config.requiredPermissions.length > 0) {
        const userPermissions = user.permissions || [];
        const hasRequiredPermissions = config.requireAll
          ? config.requiredPermissions.every(permission => userPermissions.includes(permission))
          : config.requiredPermissions.some(permission => userPermissions.includes(permission));

        if (!hasRequiredPermissions) {
          console.error(
            `Permission check failed [${requestId}]: Required ${config.requiredPermissions.join(', ')}, `
            + `got ${userPermissions.join(', ')}`,
          );
          throw new HTTPException(403, { message: 'FORBIDDEN' });
        }
      }

      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      console.error(`Auth check error [${requestId}]:`, error);
      throw new HTTPException(500, { message: 'AUTH_ERROR' });
    }
  });
}

/**
 * Get authenticated user from context
 */
export function getAuthenticatedUser(c: Context<HonoEnv>): AuthenticatedUser {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'NO_SESSION' });
  }
  return user;
}

/**
 * Convenience middleware for admin-only routes
 */
export const requireAdmin = requireAuth({ requiredRole: 'admin' });

/**
 * Check if user has specific permission
 */
export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  return user.permissions?.includes(permission) ?? false;
}

/**
 * Check if user has specific role
 */
export function hasRole(user: AuthenticatedUser, role: string): boolean {
  return user.role === role;
}
