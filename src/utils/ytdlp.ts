import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Readable } from 'stream';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Logger } from './logger';
import { formatDuration } from './timeFormat';

export interface YtdlpStreamResult {
  stream: Readable;
  type: 'arbitrary';
}

export interface YtdlpDownloadResult {
  filePath: string;
  videoId: string;
}

export interface DownloadProgress {
  percentage: number;
  downloaded: string;
  total: string;
  speed: string;
  eta: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
}

/**
 * Extract video ID from YouTube URL
 * @param {string} url - YouTube video URL
 * @return {string} Video ID
 */
export function extractVideoId(url: string): string {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  if (!match || !match[1]) {
    throw new Error('Invalid YouTube URL');
  }
  return match[1];
}

/**
 * Validate if a string is a valid YouTube URL (video or playlist)
 * @param {string} url - URL to validate
 * @return {boolean} True if valid YouTube video or playlist URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  const regex =
    /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/playlist\?list=)[\w-]+/;
  return regex.test(url);
}

/**
 * Check if URL is a YouTube playlist
 * @param {string} url - URL to check
 * @return {boolean} True if URL contains playlist parameter
 */
export function isPlaylistUrl(url: string): boolean {
  return url.includes('list=') && url.includes('youtube.com');
}

/**
 * Search YouTube videos using yt-dlp and return multiple results
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @return {Promise<VideoInfo[]>} Search results
 */
export async function searchYouTubeMultiple(query: string, limit: number = 5): Promise<VideoInfo[]> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('/snap/bin/yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--playlist-end',
      limit.toString(),
      `ytsearch:${query}`,
    ]);

    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp search failed with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        const lines = output.trim().split('\n').filter((line) => line.trim());
        const results: VideoInfo[] = [];

        for (const line of lines) {
          const videoData = JSON.parse(line);
          results.push({
            id: videoData.id || '',
            title: videoData.title || 'Unknown Title',
            url: videoData.webpage_url || `https://www.youtube.com/watch?v=${videoData.id}`,
            duration: formatDuration(videoData.duration || 0),
            thumbnail: videoData.thumbnail || '',
          });
        }
        resolve(results);
      } catch (error) {
        reject(new Error(`Failed to parse search results: ${(error as Error).message}`));
      }
    });

    ytdlp.on('error', (error) => {
      reject(new Error(`yt-dlp search process error: ${error.message}`));
    });
  });
}

/**
 * Search YouTube videos using yt-dlp
 * @param {string} query - Search query
 * @return {Promise<VideoInfo | null>} First search result or null
 */
export async function searchYouTube(query: string): Promise<VideoInfo | null> {
  const results = await searchYouTubeMultiple(query, 1);
  return results[0] || null;
}


/**
 * Parse download progress from yt-dlp stderr output
 * @param {string} data - Raw stderr data from yt-dlp
 * @return {DownloadProgress | null} Parsed progress or null if not a progress line
 */
function parseDownloadProgress(data: string): DownloadProgress | null {
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
 * Get playlist information using yt-dlp
 * @param {string} url - YouTube playlist URL
 * @return {Promise<VideoInfo[]>} Array of video information from playlist
 */
export async function getPlaylistInfo(url: string): Promise<VideoInfo[]> {
  return new Promise((resolve, reject) => {
    // Extract playlist ID from URL for direct playlist access
    let playlistUrl = url;
    const playlistMatch = url.match(/[&?]list=([^&]+)/);
    if (playlistMatch) {
      const playlistId = playlistMatch[1];
      playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    }

    const ytdlp = spawn('/snap/bin/yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--flat-playlist',
      // '--playlist-end',
      // '50', // Limit to 50 videos to prevent overwhelming
      playlistUrl,
    ]);

    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        // If playlist extraction fails, try to extract just the single video
        if (
          errorOutput.includes('playlist does not exist') ||
          errorOutput.includes('Unable to recognize playlist') ||
          errorOutput.includes('This playlist type is unviewable') ||
          errorOutput.includes('playlist type is unviewable')
        ) {
          // Extract the single video ID and return it as a single-item playlist
          const videoMatch = url.match(/[?&]v=([^&]+)/);
          if (videoMatch && videoMatch[1]) {
            const videoId = videoMatch[1];
            Logger.warn(
              `Playlist extraction failed, falling back to single video: ${videoId}. ` +
              `Error: ${errorOutput.trim()}`,
            );
            // Get info for the single video
            getSingleVideoAsPlaylist(videoId).then(resolve).catch(reject);
            return;
          }
        }
        reject(new Error(`yt-dlp exited with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        const lines = output
          .trim()
          .split('\n')
          .filter((line) => line.trim());
        const videos: VideoInfo[] = [];

        for (const line of lines) {
          try {
            const videoData = JSON.parse(line);
            if (videoData.id && videoData.title) {
              const videoInfo: VideoInfo = {
                id: videoData.id,
                title: videoData.title,
                url: `https://www.youtube.com/watch?v=${videoData.id}`,
                duration: formatDuration(videoData.duration || 0),
                thumbnail: videoData.thumbnail || '',
              };
              videos.push(videoInfo);
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }

        if (videos.length === 0) {
          // If no videos found in playlist format, try single video
          const videoMatch = url.match(/[?&]v=([^&]+)/);
          if (videoMatch && videoMatch[1]) {
            const videoId = videoMatch[1];
            Logger.warn(`No videos found in playlist, falling back to single video: ${videoId}`);
            getSingleVideoAsPlaylist(videoId).then(resolve).catch(reject);
            return;
          }
        }

        resolve(videos);
      } catch (error) {
        reject(new Error(`Failed to parse playlist info: ${(error as Error).message}`));
      }
    });

    ytdlp.on('error', (error) => {
      reject(new Error(`yt-dlp process error: ${error.message}`));
    });
  });
}

/**
 * Get single video info as if it were a playlist with one item
 * @param {string} videoId - YouTube video ID
 * @return {Promise<VideoInfo[]>} Array with single video
 */
async function getSingleVideoAsPlaylist(videoId: string): Promise<VideoInfo[]> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoInfo = await getVideoInfo(videoUrl);
    return [videoInfo];
  } catch (error) {
    throw new Error(`Failed to get single video info: ${(error as Error).message}`);
  }
}

/**
 * Get video information using yt-dlp
 * @param {string} url - YouTube video URL
 * @return {Promise<VideoInfo>} Video information
 */
export async function getVideoInfo(url: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('/snap/bin/yt-dlp', ['--dump-json', '--no-warnings', url]);

    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        const videoData = JSON.parse(output);
        const videoInfo: VideoInfo = {
          id: videoData.id || extractVideoId(url),
          title: videoData.title || 'Unknown Title',
          url: videoData.webpage_url || url,
          duration: formatDuration(videoData.duration || 0),
          thumbnail: videoData.thumbnail || '',
        };
        resolve(videoInfo);
      } catch (error) {
        reject(new Error(`Failed to parse video info: ${(error as Error).message}`));
      }
    });

    ytdlp.on('error', (error) => {
      reject(new Error(`yt-dlp process error: ${error.message}`));
    });
  });
}
/**
 * Get related video info for a given video
 * @param {string} url - Current video URL
 * @param {string[]} history - Array of previously played video URLs
 * @return {Promise<VideoInfo | null>} A related video or null
 */
export async function getRelatedVideo(url: string, history: string[] = []): Promise<VideoInfo | null> {
  return new Promise((resolve, reject) => {
    // We use --dump-json to get related videos from the info dict
    const ytdlp = spawn('/snap/bin/yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--flat-playlist',
      url,
    ]);

    let output = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.on('close', (_code) => {
      try {
        if (!output.trim()) {
          resolve(null);
          return;
        }

        const info = JSON.parse(output);
        const related = info.related_videos;

        if (related && Array.isArray(related) && related.length > 0) {
          // Filter out videos that are in history
          const unplayedRelated = related.filter((r) => {
            if (!r.id) return false;
            const videoUrl = `https://www.youtube.com/watch?v=${r.id}`;
            return !history.includes(videoUrl) && videoUrl !== url;
          });

          // Pick the first unplayed related video
          const firstRelated = unplayedRelated[0];
          if (firstRelated) {
            resolve({
              id: firstRelated.id,
              title: firstRelated.title || 'Unknown Title',
              url: `https://www.youtube.com/watch?v=${firstRelated.id}`,
              duration: formatDuration(firstRelated.duration || 0),
              thumbnail: firstRelated.thumbnail || '',
            });
            return;
          }
        }

        // Fallback: search for related to the title
        Logger.debug(`No related videos found in JSON for ${url}, using fallback search`);
        searchYouTube(`related to ${info.title}`).then(resolve).catch(reject);
      } catch (error) {
        // Fallback search if parsing fails
        Logger.debug(`Failed to parse related videos for ${url}, using fallback search`);
        resolve(null);
      }
    });

    ytdlp.on('error', (error) => {
      reject(new Error(`yt-dlp related process error: ${error.message}`));
    });
  });
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
