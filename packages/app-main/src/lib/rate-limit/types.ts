/**
 * Rate limit tier configuration
 */
export interface RateLimitTier {
  /** Unique identifier for this tier */
  id: string;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Human-readable description */
  description: string;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp when the window resets */
  reset: number;
}

/**
 * Rate limit error response format
 */
export interface RateLimitErrorResponse {
  error: string;
  code: "RATE_LIMIT_EXCEEDED";
  limit: number;
  remaining: number;
  /** Seconds until retry */
  retryAfter: number;
}

/**
 * Available tier identifiers
 */
export type RateLimitTierId = "expensive_llm" | "standard_llm" | "auth";
