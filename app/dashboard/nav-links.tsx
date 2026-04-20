"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "首頁", match: (p: string) => p === "/dashboard" },
  { href: "/dashboard/transcribe", label: "辨識字幕", match: (p: string) => p.startsWith("/dashboard/transcribe") },
  { href: "/dashboard/dictionary", label: "詞庫管理", match: (p: string) => p.startsWith("/dashboard/dictionary") },
  { href: "/dashboard/history", label: "辨識紀錄", match: (p: string) => p.startsWith("/dashboard/history") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="topnav">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={n.match(pathname) ? "active" : ""}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
