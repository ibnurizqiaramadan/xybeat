/* eslint-disable @typescript-eslint/no-unused-vars */
import { spawn } from 'child_process';
import { Logger } from '../logger';
import { formatDuration } from '../timeFormat';
import { VideoInfo } from './types';
import { searchYouTube, searchYouTubeMultiple } from './search';
import { extractVideoId } from './validation';

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

    ytdlp.on('close', async(_code) => {
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

        // Fallback: search for related to the title using multiple results to filter history
        Logger.debug(`No related videos found in JSON for ${url}, using fallback search`);
        const searchResults = await searchYouTubeMultiple(`similar songs to ${info.title} music genre`);

        // Filter out videos that are in history
        const unplayedSearchResults = searchResults.filter((r) => {
          if (!r.url) return false;
          return !history.includes(r.url) && r.url !== url;
        });

        if (unplayedSearchResults.length > 0 && unplayedSearchResults[0]) {
          resolve(unplayedSearchResults[0]);
        } else if (searchResults.length > 0 && searchResults[0]) {
          // Absolute fallback if everything is in history
          resolve(searchResults[0]);
        } else {
          resolve(null);
        }
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
