import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "./signout-button";
import { NavLinks } from "./nav-links";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">字</div>
          <span>Subtitle</span>
        </div>
        <NavLinks />
        <div className="topbar-right">
          <span className="hidden sm:inline">{session.user?.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
