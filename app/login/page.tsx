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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          padding: 36,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              background: "var(--text)",
              color: "var(--bg-card)",
              display: "inline-grid",
              placeItems: "center",
              fontFamily: "var(--font-serif)",
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            字
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 22,
              letterSpacing: 3,
              margin: 0,
            }}
          >
            Subtitle
          </h1>
          <p
            style={{
              fontSize: "var(--fs-sm)",
              color: "var(--text-muted)",
              marginTop: 4,
              fontWeight: 400,
            }}
          >
            字幕辨識系統
          </p>
        </div>

        {sp.error && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: "var(--radius)",
              background: "var(--red-light)",
              color: "var(--red)",
              fontSize: "var(--fs-sm)",
            }}
          >
            登入失敗：{sp.error}
          </div>
        )}

        <SignInButton callbackUrl={sp.callbackUrl || "/dashboard"} />

        <p
          style={{
            fontSize: "var(--fs-xs)",
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: 20,
            fontWeight: 400,
          }}
        >
          只允許白名單 Google 帳號登入
        </p>
      </div>
    </main>
  );
}
