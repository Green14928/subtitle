import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "./signin-button";

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await auth();
  if (session) redirect(sp.callbackUrl || "/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-pink-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-100 mb-4">
            <span className="text-3xl">🎬</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Subtitle</h1>
          <p className="text-sm text-slate-600 mt-1">字幕辨識系統</p>
        </div>

        {sp.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            登入失敗：{sp.error}
          </div>
        )}

        <SignInButton callbackUrl={sp.callbackUrl || "/dashboard"} />

        <p className="text-xs text-slate-400 text-center mt-6">
          只允許白名單 Google 帳號登入
        </p>
      </div>
    </main>
  );
}
