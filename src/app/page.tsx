import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="flex w-full max-w-md flex-col gap-8 rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">낮병원 관리 시스템</h1>
          <p className="mt-2 text-slate-500">환자 출석 및 진찰 관리</p>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            href="/patient"
            className="flex h-16 items-center justify-center rounded-xl bg-emerald-500 text-xl font-bold text-white transition hover:bg-emerald-600"
          >
            환자용 출석 체크
          </Link>
          
          <div className="relative flex items-center py-2">
            <div className="grow border-t border-slate-200"></div>
            <span className="mx-4 shrink-0 text-sm text-slate-400">또는</span>
            <div className="grow border-t border-slate-200"></div>
          </div>

          <Link
            href="/login"
            className="flex h-14 items-center justify-center rounded-xl border-2 border-slate-200 text-lg font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            직원 / 의사 로그인
          </Link>
        </div>
      </div>
    </main>
  );
}
