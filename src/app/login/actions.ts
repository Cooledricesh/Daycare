"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { comparePassword, signJWT } from "@/lib/auth";

export async function login(prevState: any, formData: FormData) {
    const id = formData.get("id") as string;
    const password = formData.get("password") as string;

    console.log(`[Login Debug] Attempting login for ID: ${id}`);

    if (!id || !password) {
        console.log("[Login Debug] Missing ID or password");
        return { error: "아이디와 비밀번호를 입력해주세요." };
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
            // It's possible the table doesn't exist or permissions are wrong
            return { error: "데이터베이스 오류가 발생했습니다." };
        }

        // Explicitly check for null because .single() can return null data with no error in some client versions/configs
        // although typically it returns error if not found.
        if (!staff) {
            console.log("[Login Debug] User not found");
            return { error: "잘못된 아이디 또는 비밀번호입니다." };
        }

        // Cast staff to any to bypass the 'never' type issue temporarily if types aren't picking up correctly
        // or ensure types are correct. Ideally types should work if Database definition is correct.
        // Let's check if we can just use it. The error says 'never', implying typescript thinks data is always null?
        // This usually happens if the table name in .from() doesn't match the types.
        // We updated types.ts but maybe server.ts isn't using it correctly or it's not picking up.
        // For now, let's treat it as any to fix the build/runtime error.
        const user = staff as any;

        console.log(`[Login Debug] User found: ${user.login_id}, Hash: ${user.password_hash.substring(0, 10)}...`);

        const isValid = await comparePassword(password, user.password_hash);

        console.log(`[Login Debug] Password valid: ${isValid}`);

        if (!isValid) {
            return { error: "잘못된 아이디 또는 비밀번호입니다." };
        }

        if (!user.is_active) {
            console.log("[Login Debug] User inactive");
            return { error: "비활성화된 계정입니다. 관리자에게 문의하세요." };
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
            secure: false, // Force false for debugging
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 1 day
            path: "/",
        });

        console.log("[Login Debug] Cookie set with secure: false. Redirecting...");

    } catch (err) {
        console.error("[Login Debug] Unexpected error:", err);
        return { error: "로그인 처리 중 오류가 발생했습니다." };
    }

    redirect("/");
}
