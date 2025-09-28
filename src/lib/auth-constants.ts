export const AUTH_ERRORS = {
  NO_SESSION: { code: 401, message: 'NO_SESSION' },
  UNAUTHORIZED: { code: 401, message: 'UNAUTHORIZED' },
  INVALID_CREDENTIALS: { code: 401, message: 'Invalid email or password' },
  FORBIDDEN: { code: 403, message: 'FORBIDDEN' },
  INSUFFICIENT_PERMISSIONS: { code: 403, message: 'Insufficient permissions' },
  USER_EXISTS: { code: 409, message: 'User already exists' },
  AUTH_ERROR: { code: 500, message: 'AUTH_ERROR' },
  CONFIG_ERROR: { code: 500, message: 'Authentication configuration error' },
  VALIDATION_ERROR: { code: 500, message: 'Authentication validation failed' },
  NO_TOKEN: { code: 401, message: 'No valid authentication token found' },
  INVALID_TOKEN: { code: 401, message: 'Invalid token structure' },
  TOKEN_EXPIRED: { code: 401, message: 'Token has expired' },
  INVALID_EMAIL: { code: 400, message: 'Invalid email format in token' },
  INVALID_SIGNATURE: { code: 401, message: 'Invalid signature' },
  MISSING_SIGNATURE: { code: 401, message: 'Missing signature' },
} as const;

export const AUTH_MESSAGES = {
  ACCOUNT_CREATED: 'Account created successfully',
  SIGNED_IN: 'Signed in successfully',
  SIGNED_OUT: 'Signed out successfully',
  PASSWORD_MIN_LENGTH: 'Password must be at least 8 characters long',
  PASSWORD_MISMATCH: 'Passwords do not match',
  ACCOUNT_CREATED_SIGNIN_FAILED: 'Account created but failed to sign in. Please try signing in manually.',
  EMAIL_PASSWORD_REQUIRED: 'Email and password are required',
  FAILED_TO_CREATE_USER: 'Failed to create user',
} as const;

export const AUTH_CONFIG = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_HASH_ROUNDS: 12,
  SESSION_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  SESSION_COOKIE_NAME: 'next-auth.session-token',
  SECURE_COOKIE_NAME: '__Secure-next-auth.session-token',
} as const;

export const AUTH_REDIRECT_PATHS = {
  SIGNIN: '/auth/signin',
  SIGNUP: '/auth/signup',
  DEFAULT_CALLBACK: '/files',
} as const;