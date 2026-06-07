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
