import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

import type { HonoEnv } from '@/types/cloudflare';

/**
 * Consistent error response structure
 */
type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    timestamp: string;
  };
  /**
   * Stack trace is only populated in development mode.
   * It will be undefined in production.
   */
  stack?: string;
};

/**
 * Global error handler following Hono best practices
 * Handles different error types and returns consistent responses
 */
export function errorHandler(err: Error | HTTPException, c: Context<HonoEnv>): Response {
  const requestId = c.get('requestId');
  const timestamp = new Date().toISOString();

  // Log all errors with context
  console.error('[Error Handler]', {
    requestId,
    error: err.message,
    type: err.constructor.name,
    url: c.req.url,
    method: c.req.method,
    ...(err instanceof HTTPException && { status: err.status }),
  });

  // Handle HTTPException (thrown by routes/middleware)
  if (err instanceof HTTPException) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: (err.cause as string) ?? 'HTTP_EXCEPTION',
        message: err.message,
        requestId,
        timestamp,
      },
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };

    return c.json(response, err.status);
  }

  // Handle Zod validation errors
/*   if (err instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.errors.map((error) => ({
          field: error.path.join('.'),
          message: error.message,
          code: error.code,
        })),
        requestId,
        timestamp,
      },
    };

    return c.json(response, 400);
  } */

  // Handle database errors
  if (err.message?.includes('UNIQUE constraint failed')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Resource already exists',
        requestId,
        timestamp,
      },
    };

    return c.json(response, 409);
  }

  if (err.message?.includes('FOREIGN KEY constraint failed')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Invalid reference to related resource',
        requestId,
        timestamp,
      },
    };

    return c.json(response, 422);
  }

  // Handle D1 database errors
  if (err.message?.includes('D1_')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        requestId,
        timestamp,
      },
    };

    return c.json(response, 500);
  }

  // Handle R2 storage errors
  if (err.message?.includes('R2') || err.message?.includes('storage')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'STORAGE_ERROR',
        message: 'Storage operation failed',
        requestId,
        timestamp,
      },
    };

    return c.json(response, 500);
  }

  // Handle file processing errors
  if (err.message?.includes('Failed to parse') || err.message?.includes('Unsupported file type')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'FILE_PROCESSING_ERROR',
        message: err.message,
        requestId,
        timestamp,
      },
    };

    return c.json(response, 422);
  }

  // Handle QStash/network errors
  if (err.message?.includes('QStash') || err.message?.includes('fetch')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'EXTERNAL_SERVICE_ERROR',
        message: 'External service request failed',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        requestId,
        timestamp,
      },
    };

    return c.json(response, 502);
  }

  // Default to internal server error
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
      requestId,
      timestamp,
    },
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  return c.json(response, 500);
}

/**
 * Helper to create HTTPException with consistent structure
 */
export function createHttpException(
  status: ContentfulStatusCode,
  code: string,
  message: string,
): HTTPException {
  return new HTTPException(status, {
    message,
    cause: code, // Use cause to store error code
  });
}

/**
 * Common error factories following Hono patterns
 */
export const ApiErrors = {
  // 400 Bad Request
  badRequest: (message = 'Bad request') =>
    createHttpException(400, 'BAD_REQUEST', message),

  // 401 Unauthorized
  unauthorized: (message = 'Authentication required') =>
    createHttpException(401, 'UNAUTHORIZED', message),

  // 403 Forbidden
  forbidden: (message = 'Insufficient permissions') =>
    createHttpException(403, 'FORBIDDEN', message),

  // 404 Not Found
  notFound: (resource: string, id?: string) =>
    createHttpException(
      404,
      'NOT_FOUND',
      id ? `${resource} with ID '${id}' not found` : `${resource} not found`,
    ),

  // 409 Conflict
  conflict: (message: string) =>
    createHttpException(409, 'CONFLICT', message),

  // 422 Unprocessable Entity
  unprocessable: (message: string) =>
    createHttpException(422, 'UNPROCESSABLE_ENTITY', message),

  // 429 Too Many Requests
  tooManyRequests: (retryAfter?: number) => {
    if (retryAfter) {
      return new HTTPException(429, {
        message: 'Too many requests',
        cause: 'TOO_MANY_REQUESTS',
        res: new Response(null, {
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() },
        }),
      });
    }
    return createHttpException(429, 'TOO_MANY_REQUESTS', 'Too many requests');
  },

  // 500 Internal Server Error
  internal: (message = 'Internal server error') =>
    createHttpException(500, 'INTERNAL_ERROR', message),

  // 503 Service Unavailable
  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    createHttpException(503, 'SERVICE_UNAVAILABLE', message),
};
