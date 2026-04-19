# 🎬 Subtitle 字幕辨識系統

身心靈頻道專用的字幕辨識工具。使用 Whisper large-v3 AI 模型 + 自訂詞庫，確保身心靈專有名詞（脈輪、阿卡西、梅爾卡巴等）辨識正確率極高。

---

## ⚡ 立刻啟動（現在就能用）

```bash
cd ~/subtitle
npm run dev
```

打開瀏覽器：http://localhost:3002

目前可以用的功能：
- ✅ 詞庫管理（分類 + 批量新增 + 刪除）
- ✅ 影片上傳 UI
- ⚠️ **字幕辨識是示範模式**（會回假資料）→ 要接真實辨識請參考下面「Phase 3」

---

## 📂 檔案結構

```
~/subtitle/
├── app/                    # Next.js 16 App Router
│   ├── dashboard/          # 登入後的主介面
│   │   ├── dictionary/     # 詞庫管理
│   │   ├── transcribe/     # 上傳辨識
│   │   └── history/        # 辨識紀錄
│   ├── login/              # 登入頁
│   └── api/                # API routes
├── lib/                    # 共用工具
│   ├── prisma.ts           # 資料庫連線
│   ├── replicate.ts        # WhisperX 整合
│   └── srt.ts              # SRT/VTT 格式化
├── prisma/
│   └── schema.prisma       # DB schema
├── auth.ts                 # NextAuth v5 設定
├── proxy.ts                # 路由保護（Next.js 16 原 middleware）
├── .env.local              # 本機環境變數（已設好）
└── .env.example            # 環境變數範本
```

---

## 🔑 環境變數清單（`.env.local`）

已經設好的：
- ✅ `DATABASE_URL`（SQLite 本機檔案）
- ✅ `AUTH_SECRET`（開發用，部署前要換）
- ✅ `AUTH_URL` / `NEXTAUTH_URL` = `http://localhost:3002`
- ✅ `AUTH_TRUST_HOST=true`
- ✅ `ALLOWED_EMAILS=amyclaw4928@gmail.com`

還要你填的：
- ⚠️ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`（下面 Phase 2 教學）
- ⚠️ `REPLICATE_API_TOKEN`（下面 Phase 3 教學）

---

## 🚶 分階段開工指南

### ✅ Phase 1：詞庫管理（**現在就能做**，不用登入也能測 API）

目前登入是用 Google OAuth，但還沒設 Google 憑證，所以進不了 dashboard。
**最快體驗方式：先設 Google 登入（Phase 2），然後就能進詞庫管理頁批量輸入詞彙。**

### 🔐 Phase 2：設定 Google 登入（5 分鐘）

1. **去 Google Cloud Console**：<https://console.cloud.google.com/apis/credentials>
2. **建立 OAuth 2.0 用戶端 ID**（如果沒有的話）
   - 應用程式類型：**網頁應用程式**
   - 已授權的 JavaScript 來源：`http://localhost:3002`
   - **已授權的重新導向 URI**：`http://localhost:3002/api/auth/callback/google`
   - ⚠️ 儲存後務必 **重新整理頁面確認 URI 還在**（GCP 儲存有時會騙人）
3. **複製 Client ID + Client Secret**，貼到 `.env.local`：
   ```
   GOOGLE_CLIENT_ID=你的ID.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=你的secret
   ```
4. **重啟 dev server**（`Ctrl+C` 然後 `npm run dev`）
5. 打開 http://localhost:3002 → 用 `amyclaw4928@gmail.com` 登入 → 進 dashboard

### 🎤 Phase 3：接真實的字幕辨識（等你要實際用的時候再做）

1. **去 Replicate 拿 API key**：<https://replicate.com/account/api-tokens>
2. **寫入 `.env.local`**：
   ```
   REPLICATE_API_TOKEN=r8_xxxxx
   ```
3. **重啟 dev server**
4. ⚠️ **本機開發限制**：Replicate 需要公開 URL 才能拉取音訊檔，而 `localhost` 外部抓不到。
   - 解法 A：用 `ngrok` 把 localhost 變成公開網址（臨時用）
   - 解法 B：部署到 Zeabur 後就沒這問題（正式上線方案）
   - 解法 C：加 Vercel Blob / Cloudflare R2 當檔案中轉（未來加）

### 🚀 Phase 4：部署到 Zeabur（字幕辨識完整可用後）

見下方「部署到 Zeabur」章節。

---

## 📖 身心靈預設詞庫範例（複製貼上到詞庫管理頁）

登入後到「詞庫管理」→「+ 新增分類」→ 建下面三類，然後在每類的批量新增區貼對應詞彙：

### 分類 1：占星術語
```
水瓶座、雙魚座、牡羊座、金牛座、雙子座、巨蟹座、獅子座、處女座、天秤座、天蠍座、射手座、摩羯座
太陽星座、月亮星座、上升星座、下降星座、天頂、天底
合相、對分相、四分相、三分相、六分相
水逆、土逆、逆行、行運、本命盤、推運盤、合盤
凱龍星、穀神星、婚神星、莉莉絲、南北交點
```

### 分類 2：能量療癒
```
脈輪、海底輪、生殖輪、太陽輪、心輪、喉輪、眉心輪、頂輪
乙太體、星光體、情緒體、心智體、因果體
昆達里尼、脈絡、經絡、氣場、光環
靈氣、雷氣、大天使、指導靈、揚升大師
梅爾卡巴、生命之花、神聖幾何、光的語言
水晶、精油、頌缽、靈擺、能量網格
```

### 分類 3：靈性哲學
```
阿卡西記錄、前世、今生、來世、業力、靈魂藍圖
高我、真我、小我、內在小孩、陰影
光之工作者、星際種子、昴宿星人、天狼星人
揚升、覺醒、開悟、合一、零點場
第五次元、第三次元、振動頻率、顯化、吸引力法則
冥想、正念、臣服、接地、錨定
```

---

## 🛠 實用指令

```bash
npm run dev              # 啟動開發伺服器 (port 3002)
npm run build            # 建立 production build
npm run db:studio        # 開 Prisma Studio（DB 視覺化工具）
npm run db:push          # 更新資料庫 schema
npm run db:generate      # 重新產生 Prisma client
```

---

## 🏥 健康檢查

```bash
curl http://localhost:3002/api/health
```

應該回傳所有環境變數狀態 + 資料庫連線狀態。

---

## 🌐 部署到 Zeabur（之後的事）

1. **Zeabur 開新 Service**，Git 連結到這個 repo
2. **在 Zeabur 建 PostgreSQL service**（同專案）
3. **把 schema 從 SQLite 改成 Postgres**：
   - `prisma/schema.prisma` → `provider = "postgresql"`
   - `DATABASE_URL=postgresql://root:pwd@postgresql.zeabur.internal:5432/zeabur`（**硬寫，不要用 `${...}` 引用**）
4. **環境變數** 設齊（參照 `.env.example`，`AUTH_URL` 改成 `https://subtitle.ascend928.com`）
5. **Google Cloud Console** 加新的 redirect URI：
   - `https://subtitle.ascend928.com/api/auth/callback/google`
   - `https://<zeabur-subdomain>.zeabur.app/api/auth/callback/google`（備用）
6. **子網域**：Cloudflare 加 CNAME → Zeabur 提供的網址

⚠️ 部署必看記憶：`~/.claude/projects/-Users-greenju/memory/feedback_google_oauth_zeabur.md`

---

## 🧰 技術棧

- **Next.js** 16.0.4（Turbopack）
- **TypeScript** 5.7
- **Tailwind CSS** v4
- **React** 19
- **NextAuth** v5 beta.31（client form 避坑版，已套好）
- **Prisma** 6.19（本機 SQLite，部署 Postgres）
- **Replicate** WhisperX large-v3
- **Zod** 型別驗證
- **Sonner** Toast 提示

---

## 🎯 給剪輯師用的流程（上線後）

1. 打開 `https://subtitle.ascend928.com`
2. 用 Google 登入（白名單帳號）
3. 「詞庫管理」先確認詞庫齊全（業主會預先建好）
4. 「辨識字幕」→ 上傳影片 → 勾選詞庫分類 → 按「開始辨識」
5. 等一下 → 下載 `.srt` 字幕檔 → 丟回剪映 / Premiere 即可

---

## 📝 下一步 TODO（給明天的自己）

- [ ] Phase 2：設好 Google 登入，實際進 dashboard 試用
- [ ] Phase 2.5：貼入身心靈預設詞庫（見上方範例）
- [ ] Phase 3：拿 Replicate API key，接真實辨識（本機要搭 ngrok）
- [ ] Phase 4：實際辨識一支身心靈影片，評估準度
- [ ] Phase 5：部署到 Zeabur，綁 `subtitle.ascend928.com`
- [ ] Phase 6：邀請 4 位剪輯師加入白名單（改 `ALLOWED_EMAILS`）

---

**建立時間**：2026-04-19
**作者**：Claude (with Green)
**授權**：Private / Internal use
