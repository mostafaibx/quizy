export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  retryable?: boolean;
  details?: unknown;
}

export const ErrorCodes = {
  // Client errors (4xx)
  INVALID_INPUT: 'INVALID_INPUT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // Processing errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  GENERATION_FAILED: 'GENERATION_FAILED',
};

export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  retryable: boolean = false
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code || ErrorCodes.INTERNAL_ERROR;
  error.retryable = retryable;
  return error;
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
  if (appError.retryable) return true;

  const retryableMessages = [
    'rate limit',
    'timeout',
    'service_unavailable',
    '429',
    '503',
    '504'
  ];

  return retryableMessages.some(msg =>
    error.message.toLowerCase().includes(msg)
  );
};