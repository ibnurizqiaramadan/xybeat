/* eslint-disable @typescript-eslint/no-unused-vars */
import { Logger } from '../logger';
import { formatDuration } from '../timeFormat';
import { VideoInfo } from './types';
import { searchYouTube, searchYouTubeMultiple, flatListing } from './search';
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
 * Get the YouTube Mix (auto-generated radio playlist) for a video.
 * @param {string} url - Seed video URL
 * @param {number} limit - Max entries to fetch; Mix playlists page on almost endlessly
 * @return {Promise<VideoInfo[]>} Mix entries, starting with the seed itself
 */
export async function getMixPlaylist(url: string, limit: number = 25): Promise<VideoInfo[]> {
  const id = extractVideoId(url);
  return flatListing(`https://www.youtube.com/watch?v=${id}&list=RD${id}`, ['--playlist-end', limit.toString()]);
}

/**
 * Pick the next radio song for autoplay.
 * Draws from the YouTube Mix of the current video and keeps the rest in `pool`,
 * so following picks need no request. Falls back to a title search when the Mix
 * is unavailable or exhausted.
 * @param {string} url - Current video URL
 * @param {string} title - Current video title
 * @param {string[]} history - Array of previously played video URLs
 * @param {VideoInfo[]} pool - Remaining Mix entries; mutated: refilled when empty, pick removed
 * @return {Promise<VideoInfo | null>} A related video or null
 */
export async function getRelatedVideo(
  url: string,
  title: string,
  history: string[] = [],
  pool: VideoInfo[] = [],
): Promise<VideoInfo | null> {
  const toId = (u: string) => {
    try {
      return extractVideoId(u);
    } catch {
      return u;
    }
  };
  const playedIds = new Set([...history.map(toId), toId(url)]);
  const unplayed = (videos: VideoInfo[]) => videos.filter((v) => v.id && !playedIds.has(v.id));

  let candidates = unplayed(pool);
  if (candidates.length === 0) {
    try {
      candidates = unplayed(await getMixPlaylist(url));
    } catch (error) {
      Logger.debug(`Mix unavailable for ${url}, using fallback search: ${(error as Error).message}`);
    }
  }

  // Random pick among the top entries: varied, but still close to the seed.
  const pick = candidates[Math.floor(Math.random() * Math.min(10, candidates.length))];
  pool.splice(0, pool.length, ...candidates.filter((v) => v !== pick));
  if (pick) return pick;

  const searchResults = await searchYouTubeMultiple(`similar songs to ${title} music genre`);
  // Absolute fallback to the first result if everything is in history
  return unplayed(searchResults)[0] ?? searchResults[0] ?? null;
}
