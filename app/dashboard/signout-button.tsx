"use client";
import { useEffect, useState } from "react";

export function SignOutButton() {
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/auth/csrf", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setCsrfToken(d.csrfToken))
      .catch(() => {});
  }, []);

  return (
    <form method="post" action="/api/auth/signout">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value="/login" />
      <button type="submit" className="logout" style={{ background: "transparent", border: "none", font: "inherit", cursor: "pointer" }}>
        登出
      </button>
    </form>
  );
}
