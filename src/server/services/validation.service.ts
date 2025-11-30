
import { z, ZodError, ZodType } from 'zod';
import { Errors } from './error-handler';

/**
 * Validation Service
 * Provides runtime validation with type safety
 */

export const validate = <T>(
  schema: ZodType<T>,
  data: unknown,
  errorMessage = 'Validation failed'
): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.issues.map(err => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      
      throw Errors.validation(errorMessage, {
        errors: formattedErrors,
      });
    }
    throw Errors.validation(errorMessage);
  }
};

export const validateAsync = async <T>(
  schema: ZodType<T>,
  data: unknown,
  errorMessage = 'Validation failed'
): Promise<T> => {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      
      throw Errors.validation(errorMessage, {
        errors: formattedErrors,
      });
    }
    throw Errors.validation(errorMessage);
  }
};

export const isValid = <T>(
  schema: ZodType<T>,
  data: unknown
): data is T => {
  const result = schema.safeParse(data);
  return result.success;
};

// Common validation schemas
export const commonSchemas = {
  id: z.string().min(1, 'ID is required'),
  email: z.string().email('Invalid email address'),
  url: z.string().url('Invalid URL'),
  uuid: z.string().uuid('Invalid UUID'),
  positiveInt: z.number().int().positive('Must be a positive integer'),
  nonNegativeInt: z.number().int().nonnegative('Must be a non-negative integer'),
  dateString: z.string().datetime('Invalid ISO date string'),
};

// Input sanitization
export const sanitize = {
  string: (input: unknown): string => {
    if (typeof input !== 'string') {
      throw Errors.badRequest('Expected string input');
    }
    return input.trim();
  },

  number: (input: unknown): number => {
    const num = Number(input);
    if (isNaN(num)) {
      throw Errors.badRequest('Expected numeric input');
    }
    return num;
  },

  boolean: (input: unknown): boolean => {
    if (typeof input === 'boolean') return input;
    if (input === 'true') return true;
    if (input === 'false') return false;
    throw Errors.badRequest('Expected boolean input');
  },

  array: <T>(input: unknown, itemValidator?: (item: unknown) => T): T[] => {
    if (!Array.isArray(input)) {
      throw Errors.badRequest('Expected array input');
    }
    if (itemValidator) {
      return input.map(itemValidator);
    }
    return input as T[];
  },
};

// Assert helpers
export const assert = {
  exists: <T>(value: T | null | undefined, message = 'Value is required'): T => {
    if (value === null || value === undefined) {
      throw Errors.badRequest(message);
    }
    return value;
  },

  notEmpty: (value: string | unknown[], message = 'Value cannot be empty'): void => {
    if (value.length === 0) {
      throw Errors.badRequest(message);
    }
  },

  isPositive: (value: number, message = 'Value must be positive'): void => {
    if (value <= 0) {
      throw Errors.badRequest(message);
    }
  },

  inRange: (
    value: number,
    min: number,
    max: number,
    message = `Value must be between ${min} and ${max}`
  ): void => {
    if (value < min || value > max) {
      throw Errors.badRequest(message);
    }
  },

  isOneOf: <T>(
    value: T,
    allowed: readonly T[],
    message?: string
  ): void => {
    if (!allowed.includes(value)) {
      throw Errors.badRequest(
        message || `Value must be one of: ${allowed.join(', ')}`
      );
    }
  },
};

