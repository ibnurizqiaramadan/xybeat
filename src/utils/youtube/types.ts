import { Readable } from 'stream';

export interface YtdlpStreamResult {
  stream: Readable;
  /** Resolves on the first decoded audio; rejects if yt-dlp fails before any. */
  ready: Promise<void>;
  /** True once yt-dlp exited with an error on its own, e.g. a mid-song network drop. */
  failed: () => boolean;
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
