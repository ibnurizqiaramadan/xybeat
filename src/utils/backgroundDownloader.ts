import { Logger } from './logger';
import { downloadYouTubeToMp3, extractVideoId, DownloadProgress } from './ytdlp';
import { Song } from '@/types/music';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Download job for the background downloader.
 */
interface DownloadJob {
  guildId: string;
  song: Song;
  priority: number; // Lower number = higher priority
  retryCount: number;
  addedAt: number;
}

/**
 * Download status for tracking.
 */
interface DownloadStatus {
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
interface DownloadConfig {
  maxConcurrentPerGuild: number;
  maxConcurrentGlobal: number;
  maxRetries: number;
  retryDelayBase: number; // Base delay in ms for exponential backoff
}

/**
 * Background downloader for pre-downloading songs in queue.
 * This improves user experience by eliminating wait times for queued songs.
 */
class BackgroundDownloaderImpl {
  private downloadQueue: DownloadJob[] = [];
  private activeDownloads = new Map<string, DownloadStatus>(); // videoId -> status
  private guildDownloadCounts = new Map<string, number>(); // guildId -> active download count
  private config: DownloadConfig = {
    maxConcurrentPerGuild: 2,
    maxConcurrentGlobal: 5,
    maxRetries: 3,
    retryDelayBase: 2000, // 2 seconds base delay
  };

  /**
   * Initialize the background downloader.
   */
  constructor() {
    Logger.info('Background downloader initialized');

    // Process download queue every 5 seconds
    setInterval(() => {
      this.processQueue();
    }, 5000);
  }

  /**
   * Add songs to the background download queue.
   * @param {string} guildId - Guild ID
   * @param {Song[]} songs - Songs to download
   * @param {number} basePriority - Base priority (lower = higher priority)
   */
  public addToQueue(guildId: string, songs: Song[], basePriority: number = 100): void {
    const newJobs: DownloadJob[] = [];

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      if (!song) continue; // Skip undefined songs

      const videoId = extractVideoId(song.url);

      // Skip if already cached
      if (this.isCached(videoId)) {
        Logger.debug(`Song already cached, skipping: ${song.title}`);
        continue;
      }

      // Skip if already in queue or downloading
      if (this.isInQueue(guildId, videoId) || this.isDownloading(videoId)) {
        Logger.debug(`Song already in download queue or downloading: ${song.title}`);
        continue;
      }

      const job: DownloadJob = {
        guildId,
        song,
        priority: basePriority + i, // Earlier songs get higher priority
        retryCount: 0,
        addedAt: Date.now(),
      };

      newJobs.push(job);
    }

    if (newJobs.length > 0) {
      this.downloadQueue.push(...newJobs);
      this.sortQueue();
      Logger.info(`Added ${newJobs.length} songs to background download queue for guild ${guildId}`);
    }
  }

  /**
   * Add a single song with high priority (e.g., next in queue).
   * @param {string} guildId - Guild ID
   * @param {Song} song - Song to download
   * @param {number} priority - Priority (default: 1 for high priority)
   */
  public addHighPriority(guildId: string, song: Song, priority: number = 1): void {
    this.addToQueue(guildId, [song], priority);
  }

  /**
   * Remove songs from download queue for a guild.
   * @param {string} guildId - Guild ID
   */
  public clearGuildQueue(guildId: string): void {
    const beforeCount = this.downloadQueue.length;
    this.downloadQueue = this.downloadQueue.filter((job) => job.guildId !== guildId);
    const removedCount = beforeCount - this.downloadQueue.length;

    if (removedCount > 0) {
      Logger.info(`Removed ${removedCount} songs from download queue for guild ${guildId}`);
    }
  }

  /**
   * Get download status for a song.
   * @param {string} videoId - Video ID
   * @return {DownloadStatus | undefined} Download status
   */
  public getDownloadStatus(videoId: string): DownloadStatus | undefined {
    return this.activeDownloads.get(videoId);
  }

  /**
   * Get queue statistics.
   * @return {object} Queue statistics
   */
  public getStats(): {
    queueSize: number;
    activeDownloads: number;
    guildDownloads: Map<string, number>;
    } {
    return {
      queueSize: this.downloadQueue.length,
      activeDownloads: this.activeDownloads.size,
      guildDownloads: new Map(this.guildDownloadCounts),
    };
  }

  /**
   * Process the download queue.
   */
  private async processQueue(): Promise<void> {
    try {
      // Check if we can start new downloads
      const totalActiveDownloads = this.activeDownloads.size;
      if (totalActiveDownloads >= this.config.maxConcurrentGlobal) {
        return; // Global limit reached
      }

      // Find next job to process
      for (const job of this.downloadQueue) {
        const guildActiveDownloads = this.guildDownloadCounts.get(job.guildId) || 0;

        // Check guild limit
        if (guildActiveDownloads >= this.config.maxConcurrentPerGuild) {
          continue; // This guild has reached its limit
        }

        // Check global limit again
        if (this.activeDownloads.size >= this.config.maxConcurrentGlobal) {
          break; // Global limit reached
        }

        // Start download
        await this.startDownload(job);
        break; // Only start one download per iteration
      }
    } catch (error) {
      Logger.error('Error processing download queue:', error as Error);
    }
  }

  /**
   * Start downloading a song.
   * @param {DownloadJob} job - Download job
   */
  private async startDownload(job: DownloadJob): Promise<void> {
    const videoId = extractVideoId(job.song.url);

    // Remove from queue
    this.downloadQueue = this.downloadQueue.filter(
      (j) => !(j.guildId === job.guildId && extractVideoId(j.song.url) === videoId),
    );

    // Track active download
    const status: DownloadStatus = {
      guildId: job.guildId,
      videoId,
      status: 'downloading',
      startedAt: Date.now(),
    };

    this.activeDownloads.set(videoId, status);
    this.incrementGuildDownloadCount(job.guildId);

    Logger.info(`Starting background download: ${job.song.title} (Guild: ${job.guildId})`);

    try {
      // Progress callback for tracking (optional)
      const progressCallback = (progress: DownloadProgress) => {
        status.progress = progress.percentage;
      };

      // Download the song
      const result = await downloadYouTubeToMp3(job.song.url, progressCallback);

      // Mark as completed
      status.status = 'completed';
      status.completedAt = Date.now();

      Logger.info(`Background download completed: ${job.song.title} -> ${result.filePath}`);

      // Remove from active downloads after a short delay
      setTimeout(() => {
        this.activeDownloads.delete(videoId);
      }, 30000); // Keep status for 30 seconds
    } catch (error) {
      Logger.error(`Background download failed: ${job.song.title}`, error as Error);

      // Mark as failed
      status.status = 'failed';
      status.error = (error as Error).message;

      // Retry logic
      if (job.retryCount < this.config.maxRetries) {
        await this.scheduleRetry(job);
      } else {
        Logger.warn(`Background download permanently failed after ${job.retryCount} retries: ${job.song.title}`);
        // Remove from active downloads after delay
        setTimeout(() => {
          this.activeDownloads.delete(videoId);
        }, 60000); // Keep failed status for 1 minute
      }
    } finally {
      this.decrementGuildDownloadCount(job.guildId);
    }
  }

  /**
   * Schedule a retry for a failed download.
   * @param {DownloadJob} job - Failed download job
   */
  private async scheduleRetry(job: DownloadJob): Promise<void> {
    job.retryCount++;
    const delay = this.config.retryDelayBase * Math.pow(2, job.retryCount - 1); // Exponential backoff

    Logger.info(`Scheduling retry ${job.retryCount}/${this.config.maxRetries} for ${job.song.title} in ${delay}ms`);

    setTimeout(() => {
      // Add back to queue with higher priority (lower number)
      job.priority = Math.max(1, job.priority - 10);
      this.downloadQueue.push(job);
      this.sortQueue();
    }, delay);
  }

  /**
   * Check if a song is already cached.
   * @param {string} videoId - Video ID
   * @return {boolean} True if cached
   */
  private isCached(videoId: string): boolean {
    const musicDir = join(homedir(), 'music-bot', 'mp3');
    const outputPath = join(musicDir, `${videoId}.mp3`);
    return existsSync(outputPath);
  }

  /**
   * Check if a song is in the download queue.
   * @param {string} guildId - Guild ID
   * @param {string} videoId - Video ID
   * @return {boolean} True if in queue
   */
  private isInQueue(guildId: string, videoId: string): boolean {
    return this.downloadQueue.some((job) =>
      job.guildId === guildId && extractVideoId(job.song.url) === videoId,
    );
  }

  /**
   * Check if a song is currently downloading.
   * @param {string} videoId - Video ID
   * @return {boolean} True if downloading
   */
  private isDownloading(videoId: string): boolean {
    const status = this.activeDownloads.get(videoId);
    return status?.status === 'downloading';
  }

  /**
   * Sort the download queue by priority.
   */
  private sortQueue(): void {
    this.downloadQueue.sort((a, b) => {
      // First by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by age (older first)
      return a.addedAt - b.addedAt;
    });
  }

  /**
   * Increment guild download count.
   * @param {string} guildId - Guild ID
   */
  private incrementGuildDownloadCount(guildId: string): void {
    const current = this.guildDownloadCounts.get(guildId) || 0;
    this.guildDownloadCounts.set(guildId, current + 1);
  }

  /**
   * Decrement guild download count.
   * @param {string} guildId - Guild ID
   */
  private decrementGuildDownloadCount(guildId: string): void {
    const current = this.guildDownloadCounts.get(guildId) || 0;
    const newCount = Math.max(0, current - 1);

    if (newCount === 0) {
      this.guildDownloadCounts.delete(guildId);
    } else {
      this.guildDownloadCounts.set(guildId, newCount);
    }
  }
}

export const backgroundDownloader = new BackgroundDownloaderImpl();
