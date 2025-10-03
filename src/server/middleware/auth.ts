import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { HonoEnv } from '@/types/cloudflare';
import type { AuthenticatedUser, AuthConfig } from '@/types/auth.types';
import { hasRole, hasAllPermissions, hasAnyPermission } from '@/lib/auth-utils';
import { AUTH_ERRORS } from '@/lib/auth-constants';
import { JWT } from 'next-auth/jwt';

/**
 * Base authentication middleware for Hono routes
 * Validates NextAuth JWT tokens from cookies directly from Request object
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  try {
    // Use native Request object directly - no NextRequest needed
    const request = c.req.raw;

    // Extract token from cookies manually
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      throw new HTTPException(401, {
        message: AUTH_ERRORS.NO_TOKEN.message
      });
    }

    // Parse cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = cookies['next-auth.session-token'] ||
                 cookies['__Secure-next-auth.session-token'];

    if (!token) {
      throw new HTTPException(401, {
        message: AUTH_ERRORS.NO_TOKEN.message
      });
    }

    // Get secret from environment
    const secret = c.env?.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
      console.error('NEXTAUTH_SECRET not found');
      throw new HTTPException(500, {
        message: AUTH_ERRORS.CONFIG_ERROR.message
      });
    }

    try {
      // Use next-auth's decode function which handles the special encoding
      const { decode } = await import('next-auth/jwt');

      const decoded = await decode({
        token,
        secret,
      });

      if (!decoded || !decoded.sub || !decoded.email) {
        throw new HTTPException(401, {
          message: AUTH_ERRORS.INVALID_TOKEN.message
        });
      }

      // Check token expiry
      if (decoded.exp && typeof decoded.exp === 'number' && decoded.exp < Date.now() / 1000) {
        throw new HTTPException(401, {
          message: AUTH_ERRORS.TOKEN_EXPIRED.message
        });
      }

      // Build user object - use NextAuth's token structure (cast to any for flexibility)
      const tokenData = decoded as JWT;
      const user: AuthenticatedUser = {
        id: String(tokenData.sub || tokenData.id),
        email: String(tokenData.email),
        name: tokenData.name ? String(tokenData.name) : undefined,
        image: tokenData.picture || tokenData.image ? String(tokenData.picture || tokenData.image) : undefined,
        role: tokenData.role ? String(tokenData.role) : 'user',
        permissions: Array.isArray(tokenData.permissions)
          ? tokenData.permissions.map(String)
          : [],
      };

      // Set user in context for downstream handlers
      c.set('user', user);
      await next();
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      throw new HTTPException(401, {
        message: AUTH_ERRORS.INVALID_TOKEN.message
      });
    }
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Auth middleware error:', error);
    throw new HTTPException(500, {
      message: AUTH_ERRORS.AUTH_ERROR.message
    });
  }
});

/**
 * Higher-order middleware factory for role and permission checking
 */
export function requireAuth(config?: AuthConfig) {
  return createMiddleware(async (c, next) => {
    try {
      // First run the basic auth middleware
      await authMiddleware(c, () => Promise.resolve());

      const user = c.get('user');
      if (!user) {
        throw new HTTPException(401, {
          message: AUTH_ERRORS.NO_SESSION.message
        });
      }

      // Check role requirements
      if (config?.requiredRole && !hasRole(user, config.requiredRole)) {
        throw new HTTPException(403, {
          message: AUTH_ERRORS.FORBIDDEN.message
        });
      }

      // Check permission requirements
      if (config?.requiredPermissions && config.requiredPermissions.length > 0) {
        const hasRequiredPermissions = config.requireAll
          ? hasAllPermissions(user, config.requiredPermissions)
          : hasAnyPermission(user, config.requiredPermissions);

        if (!hasRequiredPermissions) {
          throw new HTTPException(403, {
            message: AUTH_ERRORS.INSUFFICIENT_PERMISSIONS.message
          });
        }
      }

      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      console.error('Auth check error:', error);
      throw new HTTPException(500, {
        message: AUTH_ERRORS.AUTH_ERROR.message
      });
    }
  });
}

/**
 * Get authenticated user from context
 */
export function getAuthenticatedUser(c: Context<HonoEnv>): AuthenticatedUser {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, {
      message: AUTH_ERRORS.NO_SESSION.message
    });
  }
  return user;
}

/**
 * Convenience middleware for admin-only routes
 */
export const requireAdmin = requireAuth({ requiredRole: 'admin' });

// Re-export utility functions for convenience
export { hasRole, hasPermission, hasAllPermissions, hasAnyPermission } from '@/lib/auth-utils';