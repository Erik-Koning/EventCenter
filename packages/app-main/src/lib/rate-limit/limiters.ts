import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "./client";
import type { RateLimitTierId, RateLimitTier } from "./types";

/**
 * Rate limit tier configurations
 */
export const RATE_LIMIT_TIERS: Record<RateLimitTierId, RateLimitTier> = {
  expensive_llm: {
    id: "expensive_llm",
    limit: 3,
    windowSeconds: 3600, // 1 hour
    description: "High-cost LLM operations (expert reviews)",
  },
  standard_llm: {
    id: "standard_llm",
    limit: 20,
    windowSeconds: 3600, // 1 hour
    description: "Standard LLM operations (validation, extraction)",
  },
  auth: {
    id: "auth",
    limit: 10,
    windowSeconds: 60, // 1 minute
    description: "Authentication endpoints (login, signup, etc.)",
  },
};

// Cache for limiter instances
const limiters = new Map<RateLimitTierId, Ratelimit | null>();

/**
 * Get or create a rate limiter for the specified tier.
 * Returns null if Redis is not available.
 */
export function getRateLimiter(tierId: RateLimitTierId): Ratelimit | null {
  // Check cache first
  if (limiters.has(tierId)) {
    return limiters.get(tierId) ?? null;
  }

  const redis = getRedisClient();
  if (!redis) {
    limiters.set(tierId, null);
    return null;
  }

  const tier = RATE_LIMIT_TIERS[tierId];

  // Use sliding window algorithm for smooth rate limiting
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tier.limit, `${tier.windowSeconds} s`),
    prefix: `chatassistant:ratelimit:${tierId}`,
    analytics: true, // Enable analytics in Upstash dashboard
  });

  limiters.set(tierId, limiter);
  return limiter;
}
