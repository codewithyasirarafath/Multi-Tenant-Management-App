export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', details = null) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

export const isAppError = (err) => err instanceof AppError;

export const mapPostgresError = (err) => {
  if (err.code === '23505') {
    return new ConflictError('Duplicate value violates unique constraint', err.detail);
  }
  if (err.code === '23503') {
    return new BadRequestError('Foreign key violation - referenced record does not exist', err.detail);
  }
  if (err.code === '23514') {
    return new BadRequestError('Check constraint violation', err.detail);
  }
  if (err.code === '22001') {
    return new BadRequestError('Value too long for column', err.detail);
  }
  return null;
};