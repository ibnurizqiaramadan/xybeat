import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { Logger } from '../logger';
import { DownloadProgress, YtdlpDownloadResult, YtdlpStreamResult } from './types';
import { extractVideoId } from './validation';
import { spawnYtdlp } from './binary';

/**
 * Parse download progress from yt-dlp stderr output
 * @param {string} data - Raw stderr data from yt-dlp
 * @return {DownloadProgress | null} Parsed progress or null if not a progress line
 */
export function parseDownloadProgress(data: string): DownloadProgress | null {
  // Match yt-dlp download progress format:
  // [download]  54.2% of  144.12MiB at    3.65MiB/s ETA 00:18
  // or completion format:
  // [download] 100% of 19.75MiB in 00:05
  const progressMatch = data.match(
    /\[download\]\s+(\d+\.?\d*)%\s+of\s+(\S+)(?:\s+at\s+(\S+)\s+ETA\s+(\S+)|\s+in\s+(\S+))?/,
  );

  if (!progressMatch || !progressMatch[1] || !progressMatch[2]) {
    return null;
  }

  const percentage = parseFloat(progressMatch[1]);
  const total = progressMatch[2];
  const speed = progressMatch[3] || 'N/A';
  const eta = progressMatch[4] || '00:00';

  const numericTotal = parseFloat(total.replace(/[^\d.]/g, '')) || 0;
  const unit = total.replace(/[\d.]/g, '');
  const downloadedVal = ((percentage / 100) * numericTotal).toFixed(1);

  return {
    percentage,
    downloaded: `${downloadedVal}${unit}`,
    total,
    speed,
    eta,
  };
}

/**
 * Path of the cached MP3 for a video.
 * @param {string} url - YouTube video URL
 * @return {string} Cache file path
 */
export function cachedMp3Path(url: string): string {
  return join(homedir(), 'music-bot', 'mp3', `${extractVideoId(url)}.mp3`);
}

/**
 * Stream a video's audio as raw PCM (s16le, 48kHz, stereo) for StreamType.Raw.
 * Seeking decodes from the start and drops audio before seekMs (-ss after -i),
 * so it works through any YTDLP_PROXY at the cost of fetching up to that point.
 * @param {string} url - YouTube video URL
 * @param {number} seekMs - Start position in milliseconds
 * @return {YtdlpStreamResult} Stream, readiness, and failure check
 */
export function createYtdlpAudioStream(url: string, seekMs: number = 0): YtdlpStreamResult {
  const ytdlp = spawnYtdlp(['-f', 'bestaudio/18/best', '-o', '-', '--quiet', url]);
  const ffmpeg = spawn('/usr/bin/ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    'pipe:0',
    ...(seekMs > 0 ? ['-ss', (seekMs / 1000).toString()] : []),
    '-f',
    's16le',
    '-ar',
    '48000',
    '-ac',
    '2',
    'pipe:1',
  ]);

  ytdlp.stdout.pipe(ffmpeg.stdin);
  // Skipping kills ffmpeg first; yt-dlp then writes into a closed pipe.
  ffmpeg.stdin.on('error', () => {});

  let lastError = '';
  ytdlp.stderr.on('data', (data) => {
    const errorLine = data
      .toString()
      .split('\n')
      .find((line: string) => line.startsWith('ERROR:'));
    if (errorLine) lastError = errorLine.trim();
  });
  ffmpeg.stderr.on('data', (data) => {
    console.error(`ffmpeg stderr: ${data}`);
  });

  // 'exit', not 'close': close waits for stdout to drain, which playback holds back.
  let ytdlpCode: number | null | undefined;
  ytdlp.on('exit', (code) => {
    ytdlpCode = code;
  });
  ytdlp.on('error', (error) => {
    lastError = `yt-dlp process error: ${error.message}`;
  });

  // Player destroyed the stream (skip/stop/end): clean up both processes.
  ffmpeg.stdout.on('close', () => {
    ffmpeg.kill();
    ytdlp.kill();
  });

  // Resolves on the first decoded audio, rejects if yt-dlp dies before any.
  const ready = new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error(`yt-dlp stream failed${lastError ? `: ${lastError}` : ''}`));
    ffmpeg.stdout.once('readable', () => {
      if (ffmpeg.stdout.readableLength > 0) resolve();
    });
    ytdlp.once('close', (code) => {
      if (code !== 0) fail();
    });
    ytdlp.once('error', fail);
    ffmpeg.once('close', fail);
  });

  return {
    stream: ffmpeg.stdout,
    ready,
    // yt-dlp died on its own (network drop, expired URL), not because we killed it.
    failed: () => ytdlpCode !== undefined && ytdlpCode !== 0 && !ytdlp.killed,
  };
}

// Concurrent callers (play + background queue) share one download per file.
const inFlight = new Map<
  string,
  { promise: Promise<YtdlpDownloadResult>; listeners: Set<(progress: DownloadProgress) => void> }
>();

/**
 * Download and convert YouTube video to MP3 using yt-dlp and ffmpeg
 * @param {string} url - YouTube video URL
 * @param {Function} progressCallback - Optional callback for download progress
 * @return {Promise<YtdlpDownloadResult>} File path and video ID
 */
export async function downloadYouTubeToMp3(
  url: string,
  progressCallback?: (progress: DownloadProgress) => void,
): Promise<YtdlpDownloadResult> {
  const videoId = extractVideoId(url);
  const outputPath = cachedMp3Path(url);
  const musicDir = dirname(outputPath);

  const existing = inFlight.get(outputPath);
  if (existing) {
    Logger.info(`Download already in progress, joining: ${outputPath}`);
    if (progressCallback) existing.listeners.add(progressCallback);
    return existing.promise;
  }

  const listeners = new Set(progressCallback ? [progressCallback] : []);
  const emit = (progress: DownloadProgress) => listeners.forEach((listener) => listener(progress));
  const promise = runDownload(url, videoId, musicDir, outputPath, emit).finally(() => {
    inFlight.delete(outputPath);
  });
  inFlight.set(outputPath, { promise, listeners });
  return promise;
}

/**
 * Resolve with a child process's exit code once it closes.
 * @param {ChildProcessWithoutNullStreams} proc - Child process
 * @param {string} name - Process name for error messages
 * @return {Promise<number | null>} Exit code
 */
function exitCode(proc: ChildProcessWithoutNullStreams, name: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    proc.on('close', resolve);
    proc.on('error', (error) => reject(new Error(`${name} process error: ${error.message}`)));
  });
}

/**
 * Download a video to MP3 unless it is already cached.
 * @param {string} url - YouTube video URL
 * @param {string} videoId - YouTube video ID
 * @param {string} musicDir - Cache directory
 * @param {string} outputPath - Final MP3 path
 * @param {Function} emit - Progress reporter
 * @return {Promise<YtdlpDownloadResult>} File path and video ID
 */
async function runDownload(
  url: string,
  videoId: string,
  musicDir: string,
  outputPath: string,
  emit: (progress: DownloadProgress) => void,
): Promise<YtdlpDownloadResult> {
  await fs.mkdir(musicDir, { recursive: true });

  try {
    await fs.access(outputPath);
    Logger.info(`File already cached: ${outputPath}`);
    emit({ percentage: 100, downloaded: 'Cached', total: 'Cached', speed: 'Instant', eta: '00:00' });
    return { filePath: outputPath, videoId };
  } catch {
    Logger.info(`File not cached, starting download: ${outputPath}`);
  }

  // Write to a temp file and rename on success, so a failed or in-progress
  // download is never mistaken for a cached one.
  const tmpPath = `${outputPath}.part`;
  try {
    const ytdlp = spawnYtdlp(['-f', 'bestaudio/18/best', '-o', '-', url]);
    const ffmpeg = spawn('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'mp3', '-y', tmpPath]);

    ytdlp.stdout.pipe(ffmpeg.stdin);

    // Kept for the error message so callers can tell permanent failures from transient ones.
    let lastError = '';
    ytdlp.stderr.on('data', (data) => {
      const dataStr = data.toString();
      console.error(`yt-dlp stderr: ${dataStr}`);
      const errorLine = dataStr.split('\n').find((line: string) => line.startsWith('ERROR:'));
      if (errorLine) lastError = errorLine.trim();

      const progress = parseDownloadProgress(dataStr);
      if (progress) {
        Logger.debug(`Progress update: ${progress.percentage}% - ${progress.speed}`);
        emit(progress);
      }
    });

    ffmpeg.stderr.on('data', (data) => {
      console.error(`ffmpeg stderr: ${data}`);
    });

    // Wait for both: ffmpeg can exit 0 on a truncated stream when yt-dlp fails mid-download.
    const [ytdlpCode, ffmpegCode] = await Promise.all([exitCode(ytdlp, 'yt-dlp'), exitCode(ffmpeg, 'ffmpeg')]);
    if (ytdlpCode !== 0) {
      throw new Error(`yt-dlp process exited with code ${ytdlpCode}${lastError ? `: ${lastError}` : ''}`);
    }
    if (ffmpegCode !== 0) throw new Error(`ffmpeg process exited with code ${ffmpegCode}`);

    await fs.rename(tmpPath, outputPath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true });
    throw error;
  }

  // Force 100% progress update on completion
  emit({ percentage: 100, downloaded: '100%', total: '100%', speed: '0.00B/s', eta: '00:00' });
  return { filePath: outputPath, videoId };
}
