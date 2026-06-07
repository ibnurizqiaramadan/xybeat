import { Readable } from 'stream';

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
