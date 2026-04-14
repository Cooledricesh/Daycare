import { NextResponse, type NextRequest } from "next/server";
import { verifyJWT } from "@/lib/token";

const PROTECTED_PATHS = ["/dashboard", "/shared"];

// 구 URL → 신 URL 레거시 리다이렉트 (북마크 보호용)
const LEGACY_REDIRECTS: Array<{ from: RegExp; to: (match: RegExpExecArray) => string }> = [
    { from: /^\/staff\/dashboard(\/?$)/, to: () => "/dashboard/staff" },
    { from: /^\/doctor\/consultation(\/?$)/, to: () => "/dashboard/doctor" },
    { from: /^\/nurse\/prescriptions(\/?$)/, to: () => "/dashboard/nurse" },
    { from: /^\/admin\/dashboard(\/?$)/, to: () => "/dashboard/admin" },
    { from: /^\/(staff|doctor|nurse|admin)(\/.*)?$/, to: (m) => `/dashboard/${m[1]}${m[2] ?? ""}` },
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const accessToken = request.cookies.get("accessToken")?.value;

    // 1. 레거시 URL을 새 URL로 리다이렉트
    for (const { from, to } of LEGACY_REDIRECTS) {
        const match = from.exec(pathname);
        if (match) {
            const target = to(match);
            const url = new URL(target, request.url);
            url.search = request.nextUrl.search;
            return NextResponse.redirect(url, 308);
        }
    }

    // 2. Check if path requires auth
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

        if (pathname.startsWith("/dashboard/admin") && !isAdmin) {
            return NextResponse.redirect(new URL("/", request.url));
        }
        if (pathname.startsWith("/dashboard/doctor") && role !== "doctor" && !isAdmin) {
            return NextResponse.redirect(new URL("/", request.url));
        }
        if (pathname.startsWith("/dashboard/nurse") && role !== "nurse" && !isAdmin) {
            return NextResponse.redirect(new URL("/", request.url));
        }
        if (pathname.startsWith("/dashboard/staff") && role !== "coordinator" && !isAdmin) {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    // 3. Redirect to role-based dashboard if already logged in and visiting login page
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
            return "/dashboard/doctor";
        case "coordinator":
            return "/dashboard/staff";
        case "nurse":
            return "/dashboard/nurse";
        case "admin":
            return "/dashboard/admin";
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
