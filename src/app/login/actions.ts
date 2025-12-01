"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { comparePassword, signJWT } from "@/lib/auth";

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

export async function login(prevState: any, formData: FormData) {
    const id = formData.get("id") as string;
    const password = formData.get("password") as string;

    console.log(`[Login Debug] Attempting login for ID: ${id}`);

    if (!id || !password) {
        console.log("[Login Debug] Missing ID or password");
        return { error: "아이디와 비밀번호를 입력해주세요.", success: false };
    }

    const supabase = createServerClient();

    try {
        const { data: staff, error } = await supabase
            .from("staff")
            .select("*")
            .eq("login_id", id)
            .single();

        if (error) {
            console.error("[Login Debug] Database error:", error);
            return { error: "데이터베이스 오류가 발생했습니다.", success: false };
        }

        if (!staff) {
            console.log("[Login Debug] User not found");
            return { error: "잘못된 아이디 또는 비밀번호입니다.", success: false };
        }

        const user = staff as any;

        console.log(`[Login Debug] User found: ${user.login_id}, role: ${user.role}`);

        const isValid = await comparePassword(password, user.password_hash);

        console.log(`[Login Debug] Password valid: ${isValid}`);

        if (!isValid) {
            return { error: "잘못된 아이디 또는 비밀번호입니다.", success: false };
        }

        if (!user.is_active) {
            console.log("[Login Debug] User inactive");
            return { error: "비활성화된 계정입니다. 관리자에게 문의하세요.", success: false };
        }

        // Generate JWT
        const token = await signJWT({
            sub: user.id,
            role: user.role,
            name: user.name,
        });

        console.log("[Login Debug] JWT generated successfully");

        // Set Cookie
        const cookieStore = await cookies();
        cookieStore.set("accessToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 1 day
            path: "/",
        });

        // Get role-based redirect URL
        const redirectUrl = getRoleBasedRedirect(user.role);
        console.log(`[Login Debug] Cookie set. Redirect URL: ${redirectUrl}`);

        // Return success with redirect URL - client will handle navigation
        return { error: "", success: true, redirectUrl };

    } catch (err) {
        console.error("[Login Debug] Unexpected error:", err);
        return { error: "로그인 처리 중 오류가 발생했습니다.", success: false };
    }
}
