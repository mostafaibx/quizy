import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { AuthenticatedUser, AuthResult } from '@/types/auth.types';
import { AUTH_ERRORS } from './auth-constants';

/**
 * Validates the session token from the request
 * Simplified version without caching - NextAuth already handles session efficiently
 */
export async function validateSession(request: NextRequest): Promise<AuthResult> {
  try {
    const secret = process.env.NEXTAUTH_SECRET;

    if (!secret) {
      console.error('NEXTAUTH_SECRET not found in environment');
      return {
        success: false,
        error: AUTH_ERRORS.CONFIG_ERROR.message,
        code: 'CONFIG_ERROR',
      };
    }

    // Get the token from the request cookies
    const token = await getToken({
      req: request,
      secret,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    if (!token) {
      return {
        success: false,
        error: AUTH_ERRORS.NO_TOKEN.message,
        code: 'NO_TOKEN',
      };
    }

    // Validate token structure
    if (!token.sub || !token.email) {
      return {
        success: false,
        error: AUTH_ERRORS.INVALID_TOKEN.message,
        code: 'INVALID_TOKEN',
      };
    }

    // Check token expiry
    if (token.exp && (token.exp as number) * 1000 < Date.now()) {
      return {
        success: false,
        error: AUTH_ERRORS.TOKEN_EXPIRED.message,
        code: 'TOKEN_EXPIRED',
      };
    }

    // Extract user information from token
    const user: AuthenticatedUser = {
      id: String(token.sub),
      email: String(token.email),
      name: token.name ? String(token.name) : undefined,
      image: token.picture ? String(token.picture) : undefined,
      role: token.role ? String(token.role) : 'user',
      permissions: Array.isArray(token.permissions)
        ? token.permissions.map(String)
        : [],
    };

    return {
      success: true,
      user,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return {
      success: false,
      error: AUTH_ERRORS.VALIDATION_ERROR.message,
      code: 'VALIDATION_ERROR',
    };
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthenticatedUser, requiredRole: string): boolean {
  return user.role === requiredRole || user.role === 'admin';
}

/**
 * Check if user has required permission
 */
export function hasPermission(user: AuthenticatedUser, requiredPermission: string): boolean {
  if (user.role === 'admin') return true; // Admins have all permissions
  return user.permissions?.includes(requiredPermission) || false;
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(user: AuthenticatedUser, permissions: string[]): boolean {
  if (user.role === 'admin') return true;
  return permissions.every(p => user.permissions?.includes(p));
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(user: AuthenticatedUser, permissions: string[]): boolean {
  if (user.role === 'admin') return true;
  return permissions.some(p => user.permissions?.includes(p));
}