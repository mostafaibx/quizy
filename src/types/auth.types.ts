export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthenticatedUser extends AuthUser {
  role?: string;
  permissions?: string[];
}

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

export interface AuthSession {
  user: SessionUser;
  expires?: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
  code?: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpResponse {
  user?: {
    id: string;
    email: string;
    name?: string | null;
  };
  error?: string;
}

export interface AuthConfig {
  requiredRole?: string;
  requiredPermissions?: string[];
  requireAll?: boolean;
}

export type AuthProvider = 'google' | 'credentials';

export type AuthErrorCode =
  | 'NO_SESSION'
  | 'NO_TOKEN'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'INVALID_EMAIL'
  | 'VALIDATION_ERROR'
  | 'CONFIG_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'AUTH_ERROR';

export interface AuthError {
  message: string;
  code?: AuthErrorCode;
}

export interface TokenPayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  role?: string;
  permissions?: string[];
  exp?: number;
  iat?: number;
}

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'expired'
  | 'past_due'
  | 'trialing';

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string | null;
  trialStart?: string | null;
  trialEnd?: string | null;
}

export interface UserPlan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'lifetime';
  features?: string[];
  limits?: Record<string, unknown>;
  isActive: boolean;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
}

export interface PasswordValidation {
  isValid: boolean;
  errors?: string[];
}

export const AUTH_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
} as const;

export type AuthRole = typeof AUTH_ROLES[keyof typeof AUTH_ROLES];

export const AUTH_PERMISSIONS = {
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',
  FILES_DELETE: 'files:delete',
  QUIZ_CREATE: 'quiz:create',
  QUIZ_READ: 'quiz:read',
  QUIZ_UPDATE: 'quiz:update',
  QUIZ_DELETE: 'quiz:delete',
  USER_MANAGE: 'user:manage',
  SUBSCRIPTION_MANAGE: 'subscription:manage',
} as const;

export type AuthPermission = typeof AUTH_PERMISSIONS[keyof typeof AUTH_PERMISSIONS];