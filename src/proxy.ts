import { NextResponse, type NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";

const PROTECTED_PATHS = ["/staff", "/doctor", "/nurse", "/admin"];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const accessToken = request.cookies.get("accessToken")?.value;

    console.log(`[Proxy] Path: ${pathname}, Token: ${accessToken ? "Present" : "Missing"}`);

    // 1. Check if path requires auth
    const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

    if (isProtected) {
        if (!accessToken) {
            console.log(`[Proxy] Redirecting to login (No Token)`);
            return redirectToLogin(request);
        }

        const payload = await verifyJWT(accessToken);
        if (!payload) {
            console.log(`[Proxy] Redirecting to login (Invalid Token)`);
            return redirectToLogin(request);
        }

        console.log(`[Proxy] Access granted for ${payload.sub}, role: ${payload.role}`);

        // Role-based access control
        const role = payload.role as string;
        if (pathname.startsWith("/admin") && role !== "admin") {
            return NextResponse.redirect(new URL("/", request.url));
        }
        if (pathname.startsWith("/doctor") && role !== "doctor") {
            return NextResponse.redirect(new URL("/", request.url));
        }
        if (pathname.startsWith("/nurse") && role !== "nurse") {
            return NextResponse.redirect(new URL("/", request.url));
        }
        if (pathname.startsWith("/staff") && role !== "coordinator") {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    // 2. Redirect to role-based dashboard if already logged in and visiting login page
    if (pathname === "/login" && accessToken) {
        const payload = await verifyJWT(accessToken);
        if (payload) {
            const role = payload.role as string;
            const redirectUrl = getRoleBasedRedirect(role);
            console.log(`[Proxy] Already logged in as ${role}, redirecting to ${redirectUrl}`);
            return NextResponse.redirect(new URL(redirectUrl, request.url));
        }
    }

    return NextResponse.next();
}

function getRoleBasedRedirect(role: string): string {
    switch (role) {
        case "doctor":
            return "/doctor/consultation";
        case "coordinator":
            return "/staff/dashboard";
        case "nurse":
            return "/nurse/prescriptions";
        case "admin":
            return "/admin/patients";
        default:
            return "/";
    }
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
