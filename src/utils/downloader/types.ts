import { Song } from '@/types/music';

/**
 * Download job for the background downloader.
 */
export interface DownloadJob {
  guildId: string;
  song: Song;
  priority: number; // Lower number = higher priority
  retryCount: number;
  addedAt: number;
}

/**
 * Download status for tracking.
 */
export interface DownloadStatus {
  guildId: string;
  videoId: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Background downloader configuration.
 */
export interface DownloadConfig {
  maxConcurrentPerGuild: number;
  maxConcurrentGlobal: number;
  maxRetries: number;
  retryDelayBase: number; // Base delay in ms for exponential backoff
}
