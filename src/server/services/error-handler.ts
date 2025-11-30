

export interface AppError extends Error {
  statusCode: number;
  code: string;
  retryable: boolean;
  details?: unknown;
}

export const ErrorCodes = {
  // Client errors (4xx)
  INVALID_INPUT: 'INVALID_INPUT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Processing errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  PARSING_FAILED: 'PARSING_FAILED',
} as const;

export const createError = (
  message: string,
  statusCode: number = 500,
  code: string = ErrorCodes.INTERNAL_ERROR,
  retryable: boolean = false,
  details?: unknown
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.retryable = retryable;
  error.details = details;
  return error;
};

// Standardized error factory methods
export const Errors = {
  // Client errors
  badRequest: (message: string, details?: unknown): AppError =>
    createError(message, 400, ErrorCodes.INVALID_INPUT, false, details),

  unauthorized: (message: string = 'Unauthorized', details?: unknown): AppError =>
    createError(message, 401, ErrorCodes.UNAUTHORIZED, false, details),

  forbidden: (message: string = 'Forbidden', details?: unknown): AppError =>
    createError(message, 403, ErrorCodes.FORBIDDEN, false, details),

  notFound: (resource: string = 'Resource', details?: unknown): AppError =>
    createError(`${resource} not found`, 404, ErrorCodes.NOT_FOUND, false, details),

  rateLimited: (message: string = 'Rate limit exceeded', details?: unknown): AppError =>
    createError(message, 429, ErrorCodes.RATE_LIMITED, true, details),

  payloadTooLarge: (message: string = 'Payload too large', details?: unknown): AppError =>
    createError(message, 413, ErrorCodes.PAYLOAD_TOO_LARGE, false, details),

  validation: (message: string, details?: unknown): AppError =>
    createError(message, 422, ErrorCodes.VALIDATION_FAILED, false, details),

  // Server errors
  internal: (message: string = 'Internal server error', details?: unknown): AppError =>
    createError(message, 500, ErrorCodes.INTERNAL_ERROR, false, details),

  database: (message: string = 'Database error', details?: unknown): AppError =>
    createError(message, 500, ErrorCodes.DATABASE_ERROR, true, details),

  storage: (message: string = 'Storage error', details?: unknown): AppError =>
    createError(message, 500, ErrorCodes.STORAGE_ERROR, true, details),

  serviceUnavailable: (message: string = 'Service unavailable', details?: unknown): AppError =>
    createError(message, 503, ErrorCodes.SERVICE_UNAVAILABLE, true, details),

  // Processing errors
  parsing: (message: string, details?: unknown): AppError =>
    createError(message, 422, ErrorCodes.PARSING_FAILED, false, details),

  generation: (message: string, details?: unknown): AppError =>
    createError(message, 422, ErrorCodes.GENERATION_FAILED, false, details),
};

export const handleProviderError = (error: Error): AppError => {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('429') || message.includes('rate limit')) {
    return createError(
      'AI provider rate limit exceeded',
      429,
      ErrorCodes.RATE_LIMITED,
      true
    );
  }

  if (message.includes('quota')) {
    return createError(
      'AI provider quota exceeded',
      429,
      ErrorCodes.BUDGET_EXCEEDED,
      false
    );
  }

  if (message.includes('timeout')) {
    return createError(
      'AI provider timeout',
      504,
      ErrorCodes.PROVIDER_ERROR,
      true
    );
  }

  return createError(
    'AI provider error',
    502,
    ErrorCodes.PROVIDER_ERROR,
    true
  );
};

export const shouldRetry = (error: Error | AppError): boolean => {
  const appError = error as AppError;
  if (appError.retryable !== undefined) return appError.retryable;

  const retryableMessages = [
    'rate limit',
    'timeout',
    'service_unavailable',
    'econnrefused',
    'enotfound',
    '429',
    '503',
    '504',
  ];

  return retryableMessages.some(msg =>
    error.message.toLowerCase().includes(msg)
  );
};

export const isAppError = (error: unknown): error is AppError => {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    'code' in error &&
    'retryable' in error
  );
};

export const toAppError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createError(
      error.message,
      500,
      ErrorCodes.INTERNAL_ERROR,
      false
    );
  }

  return createError(
    String(error),
    500,
    ErrorCodes.INTERNAL_ERROR,
    false
  );
};