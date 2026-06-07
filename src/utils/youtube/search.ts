import { spawn } from 'child_process';
import { formatDuration } from '../timeFormat';
import { VideoInfo } from './types';

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
