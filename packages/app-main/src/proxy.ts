import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";

/*
Proxy
Good to know: Starting with Next.js 16, Middleware is now called Proxy to better reflect its purpose. The functionality remains the same.

Proxy allows you to run code before a request is completed. Then, based on the incoming request, you can modify the response by rewriting, redirecting, modifying the request or response headers, or responding directly.
*/

const PUBLIC_ROUTES = ["/login", "/signup", "/verify-email", "/auth/two-factor"];

export async function proxy(request: NextRequest) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	const { pathname } = request.nextUrl;
	const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

	// 1. If user is authenticated
	if (session) {
		// Redirect authenticated but UNVERIFIED users to a "check your email" page
		// (Except if they are already on a public route or the verify-email page)
		if (!session.user.emailVerified && !isPublicRoute) {
			return NextResponse.redirect(new URL("/verify-email", request.url));
		}

		// Redirect verified users away from landing/login/signup to dashboard
		if (session.user.emailVerified && isPublicRoute) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}

		return NextResponse.next();
	}

	// 2. If user is NOT authenticated
	// Redirect to login if trying to access any non-public route
	if (!isPublicRoute) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	// Match all routes except api, static files, and internal next files
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
