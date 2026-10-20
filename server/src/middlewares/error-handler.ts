import { ZodError } from "zod";
import type { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {

// If headers have already been sent, we cannot safely send another response, may cause an ERR_HTTP_HEADERS_SENT error
// passing error to Express to handle it instead

  if(res.headersSent) {
    next(err)
    return;
  }

  if(err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if(err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error("Unhandled Server Error:", err);
  res.status(500).json({
    error: err instanceof Error ? err.message : "Internal server error",
  });
}