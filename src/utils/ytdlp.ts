import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Readable } from 'stream';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface YtdlpStreamResult {
  stream: Readable;
  type: 'arbitrary';
}

export interface YtdlpDownloadResult {
  filePath: string;
  videoId: string;
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
 * Search YouTube videos using yt-dlp
 * @param {string} query - Search query
 * @return {Promise<VideoInfo | null>} First search result or null
 */
export async function searchYouTube(query: string): Promise<VideoInfo | null> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('/snap/bin/yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--playlist-end',
      '1',
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
        if (!output.trim()) {
          resolve(null);
          return;
        }

        const videoData = JSON.parse(output);
        const videoInfo: VideoInfo = {
          id: videoData.id || '',
          title: videoData.title || 'Unknown Title',
          url: videoData.webpage_url || `https://www.youtube.com/watch?v=${videoData.id}`,
          duration: formatDuration(videoData.duration || 0),
          thumbnail: videoData.thumbnail || '',
        };
        resolve(videoInfo);
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
 * Format duration from seconds to MM:SS or HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @return {string} Formatted duration
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
          errorOutput.includes('Unable to recognize playlist')
        ) {
          // Extract the single video ID and return it as a single-item playlist
          const videoMatch = url.match(/[?&]v=([^&]+)/);
          if (videoMatch && videoMatch[1]) {
            const videoId = videoMatch[1];
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
 * @return {Promise<YtdlpDownloadResult>} File path and video ID
 */
export async function downloadYouTubeToMp3(url: string): Promise<YtdlpDownloadResult> {
  try {
    const videoId = extractVideoId(url);
    const musicDir = join(homedir(), 'music-bot', 'mp3');
    const outputPath = join(musicDir, `${videoId}.mp3`);

    // Ensure the directory exists
    await fs.mkdir(musicDir, { recursive: true });

    // Check if file already exists
    try {
      await fs.access(outputPath);
      console.log(`File already exists: ${outputPath}`);
      return { filePath: outputPath, videoId };
    } catch {
      // File doesn't exist, proceed with download
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
        console.error(`yt-dlp stderr: ${data}`);
      });

      ffmpeg.stderr.on('data', (data) => {
        console.error(`ffmpeg stderr: ${data}`);
      });

      // Handle process completion
      ffmpeg.on('close', (code) => {
        if (code === 0) {
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
