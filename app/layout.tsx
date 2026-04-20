import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Ascend.Subtitle 字幕辨識系統",
  description: "Whisper large-v3 + 自訂詞庫的字幕辨識工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
