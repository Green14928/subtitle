import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "./signout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-bold text-slate-900 flex items-center gap-2">
              <span className="text-xl">🎬</span>
              <span>Subtitle</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard/transcribe"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                辨識字幕
              </Link>
              <Link
                href="/dashboard/dictionary"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                詞庫管理
              </Link>
              <Link
                href="/dashboard/history"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                辨識紀錄
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 hidden sm:inline">
              {session.user?.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
