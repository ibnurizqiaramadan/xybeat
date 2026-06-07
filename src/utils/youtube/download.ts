import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Readable } from 'stream';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Logger } from '../logger';
import { DownloadProgress, YtdlpDownloadResult, YtdlpStreamResult } from './types';
import { extractVideoId } from './validation';

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
 * Create an audio stream using native yt-dlp binary to be used by @discordjs/voice.
 * @param {string} url - Canonical YouTube video URL.
 * @return {Promise<YtdlpStreamResult>} Readable stream and type metadata.
 */
export async function createYtdlpAudioStream(url: string): Promise<YtdlpStreamResult> {
  try {
    const proc: ChildProcessWithoutNullStreams = spawn('/snap/bin/yt-dlp', [
      url,
      '--format',
      'bestaudio[ext=webm]/bestaudio/best',
      '--output',
      '-',
      '--quiet',
      '--no-check-certificate',
      '--prefer-free-formats',
      '--audio-format',
      'best',
    ]);

    // Handle process errors
    proc.on('error', (error) => {
      throw new Error(`yt-dlp process error: ${error.message}`);
    });

    return { stream: proc.stdout as Readable, type: 'arbitrary' };
  } catch (error) {
    throw new Error(`Failed to create yt-dlp stream: ${(error as Error).message}`);
  }
}

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
  try {
    const videoId = extractVideoId(url);
    const musicDir = join(homedir(), 'music-bot', 'mp3');
    const outputPath = join(musicDir, `${videoId}.mp3`);

    // Ensure the directory exists
    await fs.mkdir(musicDir, { recursive: true });

    // Check if file already exists
    try {
      await fs.access(outputPath);
      Logger.info(`File already cached: ${outputPath}`);

      // If file exists, simulate instant progress for callback if provided
      if (progressCallback) {
        progressCallback({
          percentage: 100,
          downloaded: 'Cached',
          total: 'Cached',
          speed: 'Instant',
          eta: '00:00',
        });
      }

      return { filePath: outputPath, videoId };
    } catch {
      // File doesn't exist, proceed with download
      Logger.info(`File not cached, starting download: ${outputPath}`);
    }

    return new Promise((resolve, reject) => {
      // Start yt-dlp process
      const ytdlp = spawn('/snap/bin/yt-dlp', ['-f', '18', '-o', '-', url]);

      // Start ffmpeg process
      const ffmpeg = spawn('/usr/bin/ffmpeg', [
        '-i',
        'pipe:0',
        '-f',
        'mp3',
        '-y', // Overwrite output file
        outputPath,
      ]);

      // Pipe yt-dlp output to ffmpeg input
      ytdlp.stdout.pipe(ffmpeg.stdin);

      // Handle errors
      ytdlp.on('error', (error) => {
        reject(new Error(`yt-dlp process error: ${error.message}`));
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`ffmpeg process error: ${error.message}`));
      });

      ytdlp.stderr.on('data', (data) => {
        const dataStr = data.toString();
        console.error(`yt-dlp stderr: ${dataStr}`);

        // Parse and report download progress if callback provided
        if (progressCallback) {
          const progress = parseDownloadProgress(dataStr);
          if (progress) {
            Logger.debug(`Progress update: ${progress.percentage}% - ${progress.speed}`);
            progressCallback(progress);
          }
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        console.error(`ffmpeg stderr: ${data}`);
      });

      // Handle process completion
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          if (progressCallback) {
            // Force 100% progress update on completion
            progressCallback({
              percentage: 100,
              downloaded: '100%',
              total: '100%',
              speed: '0.00B/s',
              eta: '00:00',
            });
          }
          resolve({ filePath: outputPath, videoId });
        } else {
          reject(new Error(`ffmpeg process exited with code ${code}`));
        }
      });

      ytdlp.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp process exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to download YouTube video: ${(error as Error).message}`);
  }
}
