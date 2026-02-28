"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { comparePassword, signJWT } from "@/lib/auth";
import type { StaffRow } from "@/lib/supabase/helpers";

const isDev = process.env.NODE_ENV === "development";

function getRoleBasedRedirect(role: string): string {
    switch (role) {
        case "doctor":
            return "/doctor/consultation";
        case "coordinator":
            return "/staff/dashboard";
        case "nurse":
            return "/nurse/prescriptions";
        case "admin":
            return "/admin/dashboard";
        default:
            return "/";
    }
}

export async function login(prevState: any, formData: FormData) {
    const id = formData.get("id") as string;
    const password = formData.get("password") as string;

    if (!id || !password) {
        return { error: "아이디와 비밀번호를 입력해주세요.", success: false };
    }

    const supabase = createServerClient();

    try {
        const { data: staff, error } = await supabase
            .from("staff")
            .select("*")
            .eq("login_id", id)
            .single();

        if (error || !staff) {
            if (isDev) console.error("[Login] Staff not found:", error?.message);
            return { error: "아이디 또는 비밀번호를 다시 확인해주세요.", success: false };
        }

        const user = staff as StaffRow;

        const isValid = await comparePassword(password, user.password_hash);

        if (!isValid) {
            return { error: "잘못된 아이디 또는 비밀번호입니다.", success: false };
        }

        if (!user.is_active) {
            return { error: "비활성화된 계정입니다. 관리자에게 문의하세요.", success: false };
        }

        // Generate JWT
        const token = await signJWT({
            sub: user.id,
            role: user.role,
            name: user.name,
        });

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

        // Return success with redirect URL - client will handle navigation
        return { error: "", success: true, redirectUrl };

    } catch (err) {
        if (isDev) console.error("[Login] Unexpected error:", err);
        return { error: "로그인 처리 중 오류가 발생했습니다.", success: false };
    }
}
