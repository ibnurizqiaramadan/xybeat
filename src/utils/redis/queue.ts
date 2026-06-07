/* eslint-disable require-jsdoc */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@/utils/logger';
import { redisClient, isRedisEnabled, keyPrefix } from './client';

export async function saveQueue(guildId: string, voiceChannelId: string, queueData: any): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const key = `${keyPrefix}queue:${guildId}:${voiceChannelId}`;
    await redisClient!.setEx(key, 3600, JSON.stringify(queueData));
    Logger.debug(`Queue saved to Redis: ${key}`);
  } catch (error) {
    Logger.error('Failed to save queue to Redis:', error as Error);
  }
}

export async function loadQueue(guildId: string, voiceChannelId: string): Promise<any | null> {
  if (!isRedisEnabled()) return null;

  try {
    const key = `${keyPrefix}queue:${guildId}:${voiceChannelId}`;
    const data = await redisClient!.get(key);

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

export async function deleteQueue(guildId: string, voiceChannelId: string): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const key = `${keyPrefix}queue:${guildId}:${voiceChannelId}`;
    await redisClient!.del(key);
    Logger.debug(`Queue deleted from Redis: ${key}`);
  } catch (error) {
    Logger.error('Failed to delete queue from Redis:', error as Error);
  }
}

export async function getGuildQueueKeys(guildId: string): Promise<string[]> {
  if (!isRedisEnabled()) return [];

  try {
    const pattern = `${keyPrefix}queue:${guildId}:*`;
    const keys = await redisClient!.keys(pattern);
    return keys;
  } catch (error) {
    Logger.error('Failed to get guild queue keys from Redis:', error as Error);
    return [];
  }
}
