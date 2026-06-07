/* eslint-disable require-jsdoc */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, RedisClientType } from 'redis';
import { Logger } from '@/utils/logger';

export let redisClient: RedisClientType | null = null;
export let isEnabled: boolean = false;
export let keyPrefix: string = 'xybeat:';

export async function initialize(): Promise<void> {
  isEnabled = process.env.REDIS_ENABLED === 'true';

  if (!isEnabled) {
    Logger.info('Redis is disabled. Queue persistence will not be available.');
    return;
  }

  try {
    keyPrefix = process.env.REDIS_KEY_PREFIX || 'xybeat:';

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

    redisClient = createClient(redisOptions);

    redisClient.on('error', (err) => {
      Logger.error('Redis connection error:', err);
      isEnabled = false;
      redisClient = null;
    });

    redisClient.on('connect', () => {
      Logger.info('Redis connected successfully');
    });

    redisClient.on('disconnect', () => {
      Logger.warn('Redis disconnected');
    });

    await redisClient.connect();
    Logger.info('Redis initialized and connected');
  } catch (error) {
    Logger.error('Failed to initialize Redis:', error as Error);
    isEnabled = false;
    redisClient = null;
  }
}

export function isRedisEnabled(): boolean {
  return isEnabled && redisClient !== null && redisClient.isOpen;
}

export async function disconnect(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.disconnect();
    Logger.info('Redis disconnected');
  }
}
