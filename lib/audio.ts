// ffmpeg 音訊處理：從影片抽音訊、壓成 16kHz mono，必要時切 chunk
// OpenAI Whisper API 單檔限制 25MB，所以處理到每個 chunk 都 < 24MB
import { exec } from "child_process";
import { promisify } from "util";
import { stat, unlink, readdir } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

export type AudioChunk = {
  path: string;
  startSec: number; // 這個 chunk 的起始時間（秒），用來 offset timestamps
};

// 抽音訊 + 壓縮（16kHz mono MP3 48kbps），輸出單一檔
// 回傳 mp3 檔路徑 + 音訊總長（秒）
export async function extractAudio(
  inputPath: string,
  outputDir: string,
  token: string
): Promise<{ audioPath: string; durationSec: number; sizeBytes: number }> {
  const audioPath = path.join(outputDir, `${token}.mp3`);
  const cmd = [
    "ffmpeg",
    "-y",
    "-i", quote(inputPath),
    "-vn",
    "-ac", "1",          // mono
    "-ar", "16000",       // 16kHz 夠 Whisper 用
    "-b:a", "48k",        // 48kbps 中文清楚夠
    "-f", "mp3",
    quote(audioPath),
  ].join(" ");

  await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });

  const s = await stat(audioPath);
  const durationSec = await probeDuration(audioPath);
  return { audioPath, durationSec, sizeBytes: s.size };
}

// 讀音訊長度（秒），用 ffprobe
export async function probeDuration(audioPath: string): Promise<number> {
  const cmd = `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 ${quote(audioPath)}`;
  const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 });
  return parseFloat(stdout.trim()) || 0;
}

// 切 chunks：每片 chunkSec 秒。回傳檔路徑 + 每片的起始秒數
// 只有當原檔 > 24MB 才會呼叫這個
export async function splitIntoChunks(
  audioPath: string,
  outputDir: string,
  token: string,
  chunkSec: number = 600 // 10 分鐘一片（48kbps mono mp3 ≈ 3.6MB）
): Promise<AudioChunk[]> {
  const pattern = path.join(outputDir, `${token}_chunk_%03d.mp3`);
  const cmd = [
    "ffmpeg",
    "-y",
    "-i", quote(audioPath),
    "-f", "segment",
    "-segment_time", String(chunkSec),
    "-c", "copy",
    quote(pattern),
  ].join(" ");

  await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });

  // 收集產出的檔案
  const files = await readdir(outputDir);
  const chunkFiles = files
    .filter((f) => f.startsWith(`${token}_chunk_`) && f.endsWith(".mp3"))
    .sort();

  return chunkFiles.map((f, i) => ({
    path: path.join(outputDir, f),
    startSec: i * chunkSec,
  }));
}

// 先抽音訊，若 >24MB 就切 chunk
export async function prepareAudioForTranscribe(
  inputPath: string,
  outputDir: string,
  token: string
): Promise<AudioChunk[]> {
  const { audioPath, sizeBytes } = await extractAudio(inputPath, outputDir, token);

  const MAX_BYTES = 24 * 1024 * 1024;
  if (sizeBytes <= MAX_BYTES) {
    return [{ path: audioPath, startSec: 0 }];
  }

  const chunks = await splitIntoChunks(audioPath, outputDir, token);
  // 抽完完整音訊不再需要，刪掉
  await safeUnlink(audioPath);
  return chunks;
}

export async function safeUnlink(p: string) {
  try {
    await unlink(p);
  } catch {
    /* ignore */
  }
}

// 簡單 shell quote，防空白/特殊字元
function quote(s: string): string {
  return `"${s.replace(/(["\\$`])/g, "\\$1")}"`;
}
