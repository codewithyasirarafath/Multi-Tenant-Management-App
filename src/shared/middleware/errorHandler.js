import { isAppError, mapPostgresError } from '../utils/errors.js';
import { ZodError } from 'zod';

export const errorHandler = (err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}`, {
    message: err.message,
    stack: err.stack,
    code: err.code,
    details: err.details,
  });

  if (err instanceof ZodError) {
    const errors = err.flatten();
    return res.status(422).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        body: errors.fieldErrors.body,
        query: errors.fieldErrors.query,
        params: errors.fieldErrors.params,
      },
    });
  }

  const pgError = mapPostgresError(err);
  if (pgError) {
    return res.status(pgError.statusCode).json({
      error: pgError.message,
      code: pgError.code,
      details: pgError.details,
    });
  }

  if (isAppError(err)) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  });
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};