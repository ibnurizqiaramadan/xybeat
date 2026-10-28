/* eslint-disable @typescript-eslint/no-unused-vars */
import { Logger } from '../logger';
import { formatDuration } from '../timeFormat';
import { VideoInfo } from './types';
import { searchYouTube, searchYouTubeMultiple } from './search';
import { extractVideoId } from './validation';
import { spawnYtdlp } from './binary';

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

    const ytdlp = spawnYtdlp([
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
                thumbnail: videoData.thumbnail || `https://i.ytimg.com/vi/${videoData.id}/hqdefault.jpg`,
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
    const ytdlp = spawnYtdlp(['--dump-json', '--no-warnings', url]);

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
          thumbnail: videoData.thumbnail || `https://i.ytimg.com/vi/${videoData.id}/hqdefault.jpg`,
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
 * Get related video info for a given video.
 * yt-dlp no longer returns related_videos for YouTube, so search by title instead.
 * @param {string} url - Current video URL
 * @param {string} title - Current video title
 * @param {string[]} history - Array of previously played video URLs
 * @return {Promise<VideoInfo | null>} A related video or null
 */
export async function getRelatedVideo(url: string, title: string, history: string[] = []): Promise<VideoInfo | null> {
  const toId = (u: string) => {
    try {
      return extractVideoId(u);
    } catch {
      return u;
    }
  };
  const playedIds = new Set([...history.map(toId), toId(url)]);

  const searchResults = await searchYouTubeMultiple(`similar songs to ${title} music genre`);
  // Absolute fallback to the first result if everything is in history
  return searchResults.find((r) => r.id && !playedIds.has(r.id)) ?? searchResults[0] ?? null;
}
