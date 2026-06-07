/* eslint-disable require-jsdoc */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@/utils/logger';
import { redisClient, isRedisEnabled, keyPrefix } from './client';

export async function getAllPlayingStateKeys(): Promise<string[]> {
  if (!isRedisEnabled()) return [];

  try {
    const pattern = `${keyPrefix}playing:*`;
    const keys = await redisClient!.keys(pattern);
    return keys;
  } catch (error) {
    Logger.error('Failed to get all playing state keys from Redis:', error as Error);
    return [];
  }
}

export async function savePlayingState(guildId: string, voiceChannelId: string, playingState: object): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const key = `${keyPrefix}playing:${guildId}:${voiceChannelId}`;
    await redisClient!.setEx(key, 1800, JSON.stringify(playingState));
    Logger.debug(`Playing state saved to Redis: ${key}`);
  } catch (error) {
    Logger.error('Failed to save playing state to Redis:', error as Error);
  }
}

export async function loadPlayingState(guildId: string, voiceChannelId: string): Promise<object | null> {
  if (!isRedisEnabled()) return null;

  try {
    const key = `${keyPrefix}playing:${guildId}:${voiceChannelId}`;
    const data = await redisClient!.get(key);

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

export async function deletePlayingState(guildId: string, voiceChannelId: string): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const key = `${keyPrefix}playing:${guildId}:${voiceChannelId}`;
    await redisClient!.del(key);
    Logger.debug(`Playing state deleted from Redis: ${key}`);
  } catch (error) {
    Logger.error('Failed to delete playing state from Redis:', error as Error);
  }
}
