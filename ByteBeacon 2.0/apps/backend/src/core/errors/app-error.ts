import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../logging/logger.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Array<{ field?: string; code: string; message: string }>;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: Array<{ field?: string; code: string; message: string }>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request input', details?: Array<{ field?: string; code: string; message: string }>) {
    super(message, 400, 'INVALID_INPUT', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const requestId = (request.id as string) || 'unknown-request-id';
  const isProd = process.env.NODE_ENV === 'production';

  logger.error(
    {
      err: error,
      requestId,
      url: request.url,
      method: request.method,
    },
    `Error handling request [${request.method} ${request.url}]`,
  );

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected internal error occurred';
  let details: Array<{ field?: string; code: string; message: string }> | undefined = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if ('statusCode' in error && typeof error.statusCode === 'number') {
    statusCode = error.statusCode;
    errorCode = error.name || 'HTTP_ERROR';
    message = isProd ? 'A request error occurred' : error.message;
  }

  reply.status(statusCode).send({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
      requestId,
    },
  });
}
