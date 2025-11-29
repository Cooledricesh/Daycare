import { NextResponse, type NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";

const PROTECTED_PATHS = ["/staff", "/doctor", "/nurse", "/admin"];
const PUBLIC_PATHS = ["/login", "/patient", "/"];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const accessToken = request.cookies.get("accessToken")?.value;

    console.log(`[Middleware] Path: ${pathname}, Token: ${accessToken ? "Present" : "Missing"}`);

    // 1. Check if path requires auth
    const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

    if (isProtected) {
        if (!accessToken) {
            console.log(`[Middleware] Redirecting to login (No Token)`);
            return redirectToLogin(request);
        }

        const payload = await verifyJWT(accessToken);
        if (!payload) {
            console.log(`[Middleware] Redirecting to login (Invalid Token)`);
            return redirectToLogin(request);
        }

        console.log(`[Middleware] Access granted for ${payload.sub}`);
        // Optional: Role-based access control can be added here
        // e.g. if (pathname.startsWith("/admin") && payload.role !== "admin") ...
    }

    // 2. Redirect to dashboard if already logged in and visiting login page
    if (pathname === "/login" && accessToken) {
        const payload = await verifyJWT(accessToken);
        if (payload) {
            console.log(`[Middleware] Already logged in, redirecting to home`);
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    return NextResponse.next();
}

function redirectToLogin(request: NextRequest) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files (images, etc)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
