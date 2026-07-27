/**
 * Global error handler middleware
 */

import { Request, Response, NextFunction } from "express";
import { Logger } from "winston";

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export function errorHandler(logger: Logger) {
  return (err: ApiError, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || "Internal server error";

    logger.error(message, {
      status,
      code: err.code,
      path: req.path,
      method: req.method,
      stack: err.stack,
    });

    res.status(status).json({
      error: message,
      code: err.code || "INTERNAL_ERROR",
      path: req.path,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  };
}

export class ValidationError extends Error {
  status = 400;
  code = "VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  status = 404;
  code = "NOT_FOUND";

  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  status = 401;
  code = "UNAUTHORIZED";

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  status = 403;
  code = "FORBIDDEN";

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
