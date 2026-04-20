import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatBytes } from "@/lib/utils";

const PATTERNS = ["pat-a", "pat-b", "pat-c", "pat-d"];

export default async function DashboardPage() {
  await auth();

  const [categoryCount, termCount, transcriptionCount, done, recent, totalText] =
    await Promise.all([
      prisma.category.count(),
      prisma.term.count(),
      prisma.transcription.count(),
      prisma.transcription.count({ where: { status: "completed" } }),
      prisma.transcription.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { user: { select: { name: true, email: true, image: true } } },
      }),
      prisma.transcription.aggregate({
        where: { status: "completed" },
        _sum: { fileSize: true },
      }),
    ]);

  const fail = transcriptionCount - done;

  // 估總字數：用最近完成的 plainText 加總（完整查會慢，簡化估）
  const recentCompleted = await prisma.transcription.findMany({
    where: { status: "completed" },
    select: { plainText: true },
    take: 200,
  });
  const totalWords = recentCompleted.reduce(
    (sum, r) => sum + (r.plainText ? r.plainText.replace(/\s+/g, "").length : 0),
    0
  );

  return (
    <div>
      <div className="page-head">
        <h1>首頁</h1>
        <div className="subtitle">歡迎使用字幕辨識系統</div>
      </div>

      <div className="stat-strip">
        <div className="stat-item">
          <div className="lbl">DICTIONARY</div>
          <div className="val">
            {categoryCount}
            <span className="unit">個分類</span>
          </div>
          <div className="caption">已啟用專有名詞庫</div>
        </div>
        <div className="stat-item">
          <div className="lbl">TERMS</div>
          <div className="val">
            {termCount}
            <span className="unit">個字詞</span>
          </div>
          <div className="caption">自訂強化辨識</div>
        </div>
        <div className="stat-item">
          <div className="lbl">RECOGNITIONS</div>
          <div className="val">
            {transcriptionCount}
            <span className="unit">次</span>
          </div>
          <div className="caption">
            {done} 次完成 · {fail} 次失敗/處理中
          </div>
        </div>
        <div className="stat-item">
          <div className="lbl">WORDS TRANSCRIBED</div>
          <div className="val">{totalWords.toLocaleString()}</div>
          <div className="caption">
            累計產出字幕字數
            {totalText._sum.fileSize
              ? ` · 已處理 ${formatBytes(totalText._sum.fileSize)}`
              : ""}
          </div>
        </div>
      </div>

      <div className="action-grid">
        <Link href="/dashboard/transcribe" className="action-card primary">
          <div>
            <div className="a-kicker">MAIN ACTION</div>
            <div className="a-title">開始辨識影片</div>
            <div className="a-desc">上傳影片 / 音訊，自動套用詞庫生成字幕</div>
          </div>
          <div className="a-foot">
            <span>支援 MP4 · MOV · M4A · WAV</span>
            <span className="a-arrow">→</span>
          </div>
          <div className="a-num">01</div>
        </Link>
        <Link href="/dashboard/dictionary" className="action-card">
          <div>
            <div className="a-kicker">DICTIONARY</div>
            <div className="a-title">管理詞庫</div>
            <div className="a-desc">新增身心靈專有名詞，讓辨識更準確</div>
          </div>
          <div className="a-foot">
            <span>
              {termCount} 個字詞 · {categoryCount} 個分類
            </span>
            <span className="a-arrow">→</span>
          </div>
          <div className="a-num">02</div>
        </Link>
      </div>

      <div className="recent">
        <div className="recent-head">
          <div className="ttl">最近辨識</div>
          <Link href="/dashboard/history" className="more">
            查看全部 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
            還沒有辨識紀錄，先去上傳一支影片吧
          </div>
        ) : (
          recent.map((t, idx) => {
            const pattern = PATTERNS[idx % PATTERNS.length];
            const uploader = t.user?.name || t.user?.email || "—";
            const charCount = t.plainText?.replace(/\s+/g, "").length ?? 0;
            return (
              <Link
                key={t.id}
                href={t.status === "completed" ? `/dashboard/history/${t.id}` : "/dashboard/history"}
                className="rec-row"
              >
                <div className={`rec-thumb ${pattern}`}>
                  {guessFormat(t.fileName)}
                </div>
                <div className="rec-info">
                  <div className="name">{t.fileName}</div>
                  <div className="meta">
                    <span>{new Date(t.createdAt).toLocaleString("zh-TW")}</span>
                    {t.fileSize && <span>{formatBytes(t.fileSize)}</span>}
                    {t.status === "completed" && charCount > 0 && (
                      <span>{charCount.toLocaleString()} 字</span>
                    )}
                    <span>上傳者：{uploader}</span>
                  </div>
                </div>
                <div className="rec-progress">
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${t.progress ?? 0}%` }} />
                  </div>
                  <div className="pct">{t.progress ?? 0}%</div>
                </div>
                <div>
                  {t.status === "completed" && (
                    <span className="status-tag done">
                      <span className="dot" />完成
                    </span>
                  )}
                  {t.status === "failed" && (
                    <span className="status-tag fail">
                      <span className="dot" />失敗
                    </span>
                  )}
                  {(t.status === "processing" || t.status === "pending") && (
                    <span className="status-tag run">
                      <span className="dot" />進行中
                    </span>
                  )}
                </div>
                <div className="rec-actions">
                  <span className="icon-btn" title="查看">→</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function guessFormat(name: string) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "FILE";
  return ext.slice(0, 4);
}
