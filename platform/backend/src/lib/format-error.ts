import { ZodError } from 'zod';
import type { Context } from 'hono';

export { ZodError };

export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

export function apiSuccess<T>(data: T) {
  return { success: true, data };
}

export function apiError(message: string, status = 400) {
  return { success: false, message, status };
}

/**
 * Format an error into a user-friendly message string.
 * Handles Zod validation errors, standard Error objects, and unknown values.
 */
export function formatError(error: unknown, fallback = '操作失败'): string {
  if (error instanceof ZodError) {
    const first = error.errors[0];
    if (!first) return fallback;
    const field = first.path.join('.');
    switch (first.code) {
      case 'invalid_string':
        if (first.validation === 'regex') {
          return field
            ? `${field} 格式不正确，仅允许小写字母、数字和连字符`
            : '格式不正确，仅允许小写字母、数字和连字符';
        }
        return field ? `${field} 格式不正确` : '格式不正确';
      case 'too_small':
        return field
          ? `${field} 至少需要 ${first.minimum} 个字符`
          : `至少需要 ${first.minimum} 个字符`;
      case 'too_big':
        return field
          ? `${field} 最多 ${first.maximum} 个字符`
          : `最多 ${first.maximum} 个字符`;
      default:
        return first.message || fallback;
    }
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}

/**
 * Handle errors in API catch blocks — ZodError → 400, others → 500
 */
export function handleError(c: Context, error: unknown, fallback = '操作失败') {
  const status = isZodError(error) ? 400 : 500;
  return c.json(apiError(formatError(error, fallback), status), status);
}
