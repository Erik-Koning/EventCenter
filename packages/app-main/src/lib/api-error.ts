import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  message: string;
  error: string;
  details?: unknown;
}

/**
 * Error codes for categorizing errors
 */
export const ErrorCode = {
  // Client errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  BAD_REQUEST: "BAD_REQUEST",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Create a standardized API error response
 */
export function apiError(
  message: string,
  error: ErrorCode,
  status: number,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    message,
    error,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Handle and format various error types into a consistent API error response
 */
export function handleApiError(
  error: unknown,
  context: string = "operation"
): NextResponse<ApiErrorResponse> {
  // Zod validation errors
  if (error instanceof z.ZodError) {
    return apiError(
      "Validation failed",
      ErrorCode.VALIDATION_ERROR,
      400,
      error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      }))
    );
  }

  // Database errors (Drizzle / pg driver)
  if (isDatabaseError(error)) {
    console.error(`[${context}] Database error:`, error);
    const dbError = error as DatabaseError;

    // Unique constraint violation (PostgreSQL 23505)
    if (dbError.code === "23505") {
      return apiError(
        "A record with this value already exists",
        ErrorCode.VALIDATION_ERROR,
        409,
        { constraint: dbError.constraint }
      );
    }

    // Foreign key violation (PostgreSQL 23503)
    if (dbError.code === "23503") {
      return apiError(
        "Referenced record not found",
        ErrorCode.NOT_FOUND,
        404,
        process.env.NODE_ENV === "development"
          ? { constraint: dbError.constraint }
          : undefined
      );
    }

    // Not-null violation (PostgreSQL 23502)
    if (dbError.code === "23502") {
      return apiError(
        "A required field is missing",
        ErrorCode.VALIDATION_ERROR,
        400,
        { column: dbError.column }
      );
    }

    // Connection errors
    if (
      dbError.message?.includes("connection") ||
      dbError.message?.includes("ECONNREFUSED") ||
      dbError.message?.includes("timeout") ||
      dbError.code === "ECONNREFUSED"
    ) {
      return apiError(
        "Unable to connect to database. Please try again later.",
        ErrorCode.DATABASE_ERROR,
        503,
        process.env.NODE_ENV === "development"
          ? { originalError: dbError.message }
          : undefined
      );
    }

    return apiError(
      "A database error occurred",
      ErrorCode.DATABASE_ERROR,
      500,
      process.env.NODE_ENV === "development"
        ? { code: dbError.code, message: dbError.message }
        : undefined
    );
  }

  // Fetch/network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    console.error(`[${context}] Network error:`, error);
    return apiError(
      "Unable to connect to external service",
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      503,
      process.env.NODE_ENV === "development"
        ? { originalError: error.message }
        : undefined
    );
  }

  // Generic Error
  if (error instanceof Error) {
    console.error(`[${context}] Error:`, error);
    return apiError(
      "An unexpected error occurred",
      ErrorCode.INTERNAL_ERROR,
      500,
      process.env.NODE_ENV === "development"
        ? { name: error.name, message: error.message }
        : undefined
    );
  }

  // Unknown error type
  console.error(`[${context}] Unknown error:`, error);
  return apiError(
    "An unexpected error occurred",
    ErrorCode.INTERNAL_ERROR,
    500
  );
}

/**
 * Type guard for database errors (pg driver / Drizzle)
 *
 * The `pg` driver throws errors with a `code` property containing
 * PostgreSQL error codes (e.g. "23505" for unique violation).
 */
interface DatabaseError {
  code: string;
  message: string;
  constraint?: string;
  column?: string;
  detail?: string;
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as DatabaseError).code === "string"
  );
}

/**
 * Common error responses
 */
export const commonErrors = {
  unauthorized: () =>
    apiError("Authentication required", ErrorCode.UNAUTHORIZED, 401),

  forbidden: () =>
    apiError("You do not have permission to perform this action", ErrorCode.FORBIDDEN, 403),

  notFound: (resource: string = "Resource") =>
    apiError(`${resource} not found`, ErrorCode.NOT_FOUND, 404),

  badRequest: (message: string, details?: unknown) =>
    apiError(message, ErrorCode.BAD_REQUEST, 400, details),

  rateLimited: (retryAfter?: number) =>
    apiError(
      "Too many requests. Please try again later.",
      ErrorCode.RATE_LIMITED,
      429,
      retryAfter ? { retryAfter } : undefined
    ),
};
