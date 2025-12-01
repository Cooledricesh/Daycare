"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "./actions";

const initialState = {
  error: "",
  success: false,
  redirectUrl: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
    >
      {pending ? "로그인 중..." : "로그인"}
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction] = useActionState(login, initialState);

  useEffect(() => {
    if (state?.success && state?.redirectUrl) {
      router.push(state.redirectUrl);
    }
  }, [state, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">직원 로그인</h1>
          <p className="mt-2 text-sm text-slate-500">
            부여받은 ID와 비밀번호를 입력하세요.
          </p>
        </header>

        <form action={formAction} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">아이디</span>
            <input
              type="text"
              name="id"
              autoComplete="username"
              required
              className="rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="예: hong"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">비밀번호</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          {state?.error && (
            <p className="text-sm font-medium text-rose-500">{state.error}</p>
          )}

          <SubmitButton />
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
            ← 메인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
