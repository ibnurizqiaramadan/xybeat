import { createClient, RedisClientType } from 'redis';
import { Logger } from './logger';

/**
 * Redis client configuration and management
 */
class RedisManager {
  private client: RedisClientType | null = null;
  private isEnabled: boolean = false;
  private keyPrefix: string = 'xybeat:';

  /**
   * Initialize Redis connection if enabled
   * @return {Promise<void>}
   */
  async initialize(): Promise<void> {
    this.isEnabled = process.env.REDIS_ENABLED === 'true';

    if (!this.isEnabled) {
      Logger.info('Redis is disabled. Queue persistence will not be available.');
      return;
    }

    try {
      this.keyPrefix = process.env.REDIS_KEY_PREFIX || 'xybeat:';

      const redisOptions: {
        socket: { host: string; port: number };
        database: number;
        password?: string;
      } = {
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        database: parseInt(process.env.REDIS_DB || '0'),
      };

      if (process.env.REDIS_PASSWORD) {
        redisOptions.password = process.env.REDIS_PASSWORD;
      }

      this.client = createClient(redisOptions);

      this.client.on('error', (err) => {
        Logger.error('Redis connection error:', err);
        this.isEnabled = false;
        this.client = null;
      });

      this.client.on('connect', () => {
        Logger.info('Redis connected successfully');
      });

      this.client.on('disconnect', () => {
        Logger.warn('Redis disconnected');
      });

      await this.client.connect();
      Logger.info('Redis initialized and connected');
    } catch (error) {
      Logger.error('Failed to initialize Redis:', error as Error);
      this.isEnabled = false;
      this.client = null;
    }
  }

  /**
   * Check if Redis is enabled and connected
   * @return {boolean}
   */
  isRedisEnabled(): boolean {
    return this.isEnabled && this.client !== null && this.client.isOpen;
  }

  /**
   * Save queue data to Redis by voice channel ID
   * @param {string} guildId - Guild ID
   * @param {string} voiceChannelId - Voice channel ID
   * @param {object[]} queueData - Queue data to save
   * @return {Promise<void>}
   */
  async saveQueue(guildId: string, voiceChannelId: string, queueData: object[]): Promise<void> {
    if (!this.isRedisEnabled()) {
      return;
    }

    try {
      const key = `${this.keyPrefix}queue:${guildId}:${voiceChannelId}`;
      await this.client!.setEx(key, 3600, JSON.stringify(queueData)); // Expire after 1 hour
      Logger.debug(`Queue saved to Redis: ${key}, ${queueData.length} songs`);
    } catch (error) {
      Logger.error('Failed to save queue to Redis:', error as Error);
    }
  }

  /**
   * Load queue data from Redis by voice channel ID
   * @param {string} guildId - Guild ID
   * @param {string} voiceChannelId - Voice channel ID
   * @return {Promise<object[] | null>}
   */
  async loadQueue(guildId: string, voiceChannelId: string): Promise<object[] | null> {
    if (!this.isRedisEnabled()) {
      return null;
    }

    try {
      const key = `${this.keyPrefix}queue:${guildId}:${voiceChannelId}`;
      const data = await this.client!.get(key);

      if (data) {
        const queueData = JSON.parse(data);
        Logger.debug(`Queue loaded from Redis: ${key}, ${queueData.length} songs`);
        return queueData;
      }

      return null;
    } catch (error) {
      Logger.error('Failed to load queue from Redis:', error as Error);
      return null;
    }
  }

  /**
   * Delete queue data from Redis
   * @param {string} guildId - Guild ID
   * @param {string} voiceChannelId - Voice channel ID
   * @return {Promise<void>}
   */
  async deleteQueue(guildId: string, voiceChannelId: string): Promise<void> {
    if (!this.isRedisEnabled()) {
      return;
    }

    try {
      const key = `${this.keyPrefix}queue:${guildId}:${voiceChannelId}`;
      await this.client!.del(key);
      Logger.debug(`Queue deleted from Redis: ${key}`);
    } catch (error) {
      Logger.error('Failed to delete queue from Redis:', error as Error);
    }
  }

  /**
   * Get all queue keys for a guild
   * @param {string} guildId - Guild ID
   * @return {Promise<string[]>}
   */
  async getGuildQueueKeys(guildId: string): Promise<string[]> {
    if (!this.isRedisEnabled()) {
      return [];
    }

    try {
      const pattern = `${this.keyPrefix}queue:${guildId}:*`;
      const keys = await this.client!.keys(pattern);
      return keys;
    } catch (error) {
      Logger.error('Failed to get guild queue keys from Redis:', error as Error);
      return [];
    }
  }

  /**
   * Save current playing song state to Redis
   * @param {string} guildId - Guild ID
   * @param {string} voiceChannelId - Voice channel ID
   * @param {object} playingState - Current playing state data
   * @return {Promise<void>}
   */
  async savePlayingState(guildId: string, voiceChannelId: string, playingState: object): Promise<void> {
    if (!this.isRedisEnabled()) {
      return;
    }

    try {
      const key = `${this.keyPrefix}playing:${guildId}:${voiceChannelId}`;
      await this.client!.setEx(key, 1800, JSON.stringify(playingState)); // Expire after 30 minutes
      Logger.debug(`Playing state saved to Redis: ${key}`);
    } catch (error) {
      Logger.error('Failed to save playing state to Redis:', error as Error);
    }
  }

  /**
   * Load current playing song state from Redis
   * @param {string} guildId - Guild ID
   * @param {string} voiceChannelId - Voice channel ID
   * @return {Promise<object | null>}
   */
  async loadPlayingState(guildId: string, voiceChannelId: string): Promise<object | null> {
    if (!this.isRedisEnabled()) {
      return null;
    }

    try {
      const key = `${this.keyPrefix}playing:${guildId}:${voiceChannelId}`;
      const data = await this.client!.get(key);

      if (data) {
        const playingState = JSON.parse(data);
        Logger.debug(`Playing state loaded from Redis: ${key}`);
        return playingState;
      }

      return null;
    } catch (error) {
      Logger.error('Failed to load playing state from Redis:', error as Error);
      return null;
    }
  }

  /**
   * Delete current playing song state from Redis
   * @param {string} guildId - Guild ID
   * @param {string} voiceChannelId - Voice channel ID
   * @return {Promise<void>}
   */
  async deletePlayingState(guildId: string, voiceChannelId: string): Promise<void> {
    if (!this.isRedisEnabled()) {
      return;
    }

    try {
      const key = `${this.keyPrefix}playing:${guildId}:${voiceChannelId}`;
      await this.client!.del(key);
      Logger.debug(`Playing state deleted from Redis: ${key}`);
    } catch (error) {
      Logger.error('Failed to delete playing state from Redis:', error as Error);
    }
  }

  /**
   * Close Redis connection
   * @return {Promise<void>}
   */
  async disconnect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      await this.client.disconnect();
      Logger.info('Redis disconnected');
    }
  }
}

// Export singleton instance
export const redisManager = new RedisManager();
