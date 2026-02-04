import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rate-limit";

const { GET: authGET, POST: authPOST } = toNextJsHandler(auth.handler);

/**
 * Extract client IP from request headers for rate limiting.
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Apply IP-based rate limiting before forwarding to Better Auth.
 * Protects login, signup, and other auth endpoints from brute-force attacks.
 */
async function withRateLimit(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<Response>
): Promise<Response> {
  const ip = getClientIP(request);
  const result = await checkRateLimit(`auth:${ip}`, "auth");

  if (!result.success) {
    return createRateLimitResponse(result, "auth");
  }

  const response = await handler(request);

  // Clone into NextResponse so we can append headers
  const next = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });

  if (result.limit > 0) {
    next.headers.set("X-RateLimit-Limit", String(result.limit));
    next.headers.set("X-RateLimit-Remaining", String(result.remaining));
    next.headers.set("X-RateLimit-Reset", String(result.reset));
  }

  return next;
}

export async function GET(request: NextRequest) {
  return withRateLimit(request, authGET as (req: NextRequest) => Promise<Response>);
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, authPOST as (req: NextRequest) => Promise<Response>);
}
