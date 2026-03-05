import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { headers } from "next/headers";
import { db } from "./db";
import { users } from "@/db/schema";
import {
  checkRateLimit,
  createRateLimitResponse,
  type RateLimitTierId,
  type RateLimitResult,
} from "./rate-limit";

/**
 * Role types for authorization
 */
export const Role = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/**
 * Permission requirements for authorization
 */
export interface PermissionRequirements {
  /** Required role (admin routes) */
  role?: Role;
  /** Allow unauthenticated users (for login/signup routes) */
  allowUnauthenticated?: boolean;
}

/**
 * Authenticated user with full database info
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  timezone: string;
  blocked: boolean;
  lastTwoFactorAt: Date | null;
  currentEventId: string | null;
}

/**
 * Result from requireAuth - either success with user or error response
 */
export type AuthResult =
  | { success: true; user: AuthenticatedUser; rateLimitResult: RateLimitResult }
  | { success: false; response: NextResponse };

/**
 * Options for requireAuth
 */
export interface RequireAuthOptions {
  /** Permission requirements */
  permissions?: PermissionRequirements;
  /** Rate limit tier (defaults to none, set to tier ID to enable) */
  rateLimit?: RateLimitTierId | false;
}

/**
 * Centralized authentication, authorization, and rate limiting for API routes.
 */
export async function requireAuth(
  options: RequireAuthOptions = {},
  request?: Request
): Promise<AuthResult> {
  const { permissions = {}, rateLimit = false } = options;

  // DEV ONLY: Auth bypass for development
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.AUTH_BYPASS_ENABLED === "true"
  ) {
    console.warn("[requireAuth] AUTH BYPASS ENABLED - Development only!");

    const mockUser: AuthenticatedUser = {
      id: "dev-bypass-user",
      email: "dev@localhost.dev",
      name: "Development User",
      role: Role.USER,
      emailVerified: true,
      timezone: "UTC",
      blocked: false,
      lastTwoFactorAt: null,
      currentEventId: null,
    };

    const mockRateLimitResult: RateLimitResult = {
      success: true,
      limit: 9999,
      remaining: 9999,
      reset: Date.now() + 3600000,
    };

    return { success: true, user: mockUser, rateLimitResult: mockRateLimitResult };
  }

  try {
    // Get session from Better Auth
    const session = await auth.api.getSession({ headers: await headers() });

    // Handle unauthenticated case
    if (!session?.user) {
      // Allow unauthenticated access for certain routes
      if (permissions.allowUnauthenticated) {
        // For unauthenticated routes, use IP-based rate limiting if enabled
        if (rateLimit && request) {
          const ip = getClientIP(request);
          const rateLimitResult = await checkRateLimit(`ip:${ip}`, rateLimit);
          if (!rateLimitResult.success) {
            return {
              success: false,
              response: createRateLimitResponse(rateLimitResult, rateLimit),
            };
          }
          // Return a minimal "user" for unauthenticated routes
          return {
            success: true,
            user: {
              id: `ip:${ip}`,
              email: "",
              name: "Anonymous",
              role: Role.USER,
              emailVerified: false,
              timezone: "UTC",
              blocked: false,
              lastTwoFactorAt: null,
              currentEventId: null,
            },
            rateLimitResult,
          };
        }
        // No rate limiting for unauthenticated route
        return {
          success: true,
          user: {
            id: "anonymous",
            email: "",
            name: "Anonymous",
            role: Role.USER,
            emailVerified: false,
            timezone: "UTC",
            blocked: false,
            lastTwoFactorAt: null,
            currentEventId: null,
          },
          rateLimitResult: {
            success: true,
            limit: 0,
            remaining: 0,
            reset: Date.now(),
          },
        };
      }

      // Authentication required but not provided
      return {
        success: false,
        response: NextResponse.json(
          { message: "Authentication required", error: "UNAUTHORIZED" },
          { status: 401 }
        ),
      };
    }

    // Get full user from database with role info using Drizzle
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        timezone: true,
        blocked: true,
        lastTwoFactorAt: true,
        currentEventId: true,
      },
    });

    if (!dbUser) {
      return {
        success: false,
        response: NextResponse.json(
          { message: "User not found", error: "NOT_FOUND" },
          { status: 404 }
        ),
      };
    }

    // Block suspended accounts
    if (dbUser.blocked) {
      return {
        success: false,
        response: NextResponse.json(
          { message: "Account suspended", error: "FORBIDDEN" },
          { status: 403 }
        ),
      };
    }

    const user: AuthenticatedUser = {
      id: dbUser.id,
      email: dbUser.email ?? "",
      name: dbUser.name,
      role: dbUser.role as Role,
      emailVerified: dbUser.emailVerified,
      timezone: dbUser.timezone,
      blocked: dbUser.blocked,
      lastTwoFactorAt: dbUser.lastTwoFactorAt,
      currentEventId: dbUser.currentEventId ?? null,
    };

    // Check role permission
    if (permissions.role && user.role !== permissions.role) {
      // Admin check - only admins can access admin routes
      if (permissions.role === Role.ADMIN) {
        return {
          success: false,
          response: NextResponse.json(
            { message: "You do not have permission to access this resource", error: "FORBIDDEN" },
            { status: 403 }
          ),
        };
      }
    }

    // Apply rate limiting if specified
    let rateLimitResult: RateLimitResult = {
      success: true,
      limit: 0,
      remaining: 0,
      reset: Date.now(),
    };

    if (rateLimit) {
      rateLimitResult = await checkRateLimit(user.id, rateLimit);
      if (!rateLimitResult.success) {
        return {
          success: false,
          response: createRateLimitResponse(rateLimitResult, rateLimit),
        };
      }
    }

    return { success: true, user, rateLimitResult };
  } catch (error) {
    console.error("[requireAuth] Error:", error);
    return {
      success: false,
      response: NextResponse.json(
        { message: "An unexpected error occurred", error: "INTERNAL_ERROR" },
        { status: 500 }
      ),
    };
  }
}

/**
 * Extract client IP from request headers
 */
function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback
  return "unknown";
}

/**
 * Helper to add rate limit headers to a successful response
 */
export function withRateLimitHeaders(
  response: NextResponse,
  rateLimitResult: RateLimitResult
): NextResponse {
  if (rateLimitResult.limit > 0) {
    response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
    response.headers.set(
      "X-RateLimit-Remaining",
      String(rateLimitResult.remaining)
    );
    response.headers.set("X-RateLimit-Reset", String(rateLimitResult.reset));
  }
  return response;
}
