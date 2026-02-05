import { NextResponse, type NextRequest } from "next/server";
import { verifyJWT } from "@/lib/token";

const PROTECTED_PATHS = ["/staff", "/doctor", "/nurse", "/admin"];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const accessToken = request.cookies.get("accessToken")?.value;

    // 1. Check if path requires auth
    const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

    if (isProtected) {
        if (!accessToken) {
            return redirectToLogin(request);
        }

        const payload = await verifyJWT(accessToken);
        if (!payload) {
            return redirectToLogin(request);
        }

        // Role-based access control (admin can access all pages)
        const role = payload.role as string;
        const isAdmin = role === "admin";

        if (pathname.startsWith("/admin") && !isAdmin) {
            return NextResponse.redirect(new URL("/", request.url));
        }
        if (pathname.startsWith("/doctor") && role !== "doctor" && !isAdmin) {
            return NextResponse.redirect(new URL("/", request.url));
        }
        if (pathname.startsWith("/nurse") && role !== "nurse" && !isAdmin) {
            return NextResponse.redirect(new URL("/", request.url));
        }
        if (pathname.startsWith("/staff") && role !== "coordinator" && !isAdmin) {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    // 2. Redirect to role-based dashboard if already logged in and visiting login page
    if (pathname === "/login" && accessToken) {
        const payload = await verifyJWT(accessToken);
        if (payload) {
            const role = payload.role as string;
            const redirectUrl = getRoleBasedRedirect(role);
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
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
