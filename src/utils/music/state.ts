/* eslint-disable valid-jsdoc, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { Logger } from '@/utils/logger';

import { redisManager } from '../redis';

import { backgroundDownloader } from '../backgroundDownloader';

import { MusicQueue, Song } from '@/types/music';

import { createQueue } from './queue';

import { playNext } from './playback';

import { PlayingState, SerializedSong, MinimalUser } from './types';
import { AudioPlayerStatus } from '@discordjs/voice';

/**
   * Periodically updates the playing state in Redis with accurate playback position
   */
export async function updatePlaybackStates(manager: any): Promise<void> {
  for (const [guildId, queue] of manager.queues.entries()) {
    if (queue.playing && queue.player && queue.lastSong) {
      if (queue.player.state.status === AudioPlayerStatus.Playing) {
        const currentDuration = queue.player.state.resource.playbackDuration;
        const totalDuration = queue.seekOffsetMs + currentDuration;

        await manager.savePlayingStateToRedis(
          guildId,
          queue.voiceChannel.id,
          queue.lastSong,
          true,
          (queue.textChannel as unknown as { id?: string }).id,
          totalDuration,
        ).catch((err: any) => Logger.error('Failed to update playback state', err));
      }
    }
  }
}


/**
   * Save queue to Redis if enabled
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   */
export async function saveQueue(manager: any, guildId: string): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (queue) {
    const serializableSongs: SerializedSong[] = queue.songs.map((song: Song) => ({
      title: song.title,
      url: song.url,
      duration: song.duration,
      thumbnail: song.thumbnail,
      requestedBy: {
        id: song.requestedBy.id,
        username: song.requestedBy.username,
        displayAvatarURL: song.requestedBy.displayAvatarURL(),
      },
    }));
    const queueData = {
      songs: serializableSongs,
      autoplay: queue.autoplay,
      history: queue.history,
    };
    await redisManager.saveQueue(guildId, queue.voiceChannel.id, queueData);
  }
}


/**
   * Load queue from Redis if available
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   * @return {Promise<Song[]>}
   */
export async function loadQueueFromRedis(manager: any, guildId: string, voiceChannelId: string): Promise<{ songs: Song[]; autoplay: boolean; history: string[] }> {
  const queueData = await redisManager.loadQueue(guildId, voiceChannelId);
  if (!queueData) {
    return { songs: [], autoplay: false, history: [] };
  }
  let rawSongs: SerializedSong[] = [];
  let autoplay = false;
  let history: string[] = [];
  if (Array.isArray(queueData)) {
    rawSongs = queueData as SerializedSong[];
  } else if (typeof queueData === 'object') {
    rawSongs = queueData.songs || [];
    autoplay = queueData.autoplay || false;
    history = queueData.history || [];
  }
  const songs = rawSongs.map((songData) => ({
    title: songData.title,
    url: songData.url,
    duration: songData.duration,
    thumbnail: songData.thumbnail,
    requestedBy: {
      id: songData.requestedBy.id,
      username: songData.requestedBy.username,
      displayAvatarURL: () => songData.requestedBy.displayAvatarURL,
    } as MinimalUser,
  } as Song));
  return { songs, autoplay, history };
}


/**
   * Save current playing state to Redis
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   * @param {Song} currentSong - Currently playing song
   * @param {boolean} isPlaying - Whether music is currently playing
   */
export async function savePlayingStateToRedis(manager: any, guildId: string, voiceChannelId: string, currentSong: Song, isPlaying: boolean, textChannelId?: string, playbackDurationMs?: number): Promise<void> {
  const playingState: PlayingState = {
    currentSong: {
      title: currentSong.title,
      url: currentSong.url,
      duration: currentSong.duration,
      thumbnail: currentSong.thumbnail,
      requestedBy: {
        id: currentSong.requestedBy.id,
        username: currentSong.requestedBy.username,
        displayAvatarURL: currentSong.requestedBy.displayAvatarURL(),
      },
    },
    isPlaying,
    timestamp: Date.now(),
    textChannelId,
    playbackDurationMs,
  };

  await redisManager.savePlayingState(guildId, voiceChannelId, playingState);
}


/**
   * Load current playing state from Redis
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   * @return {Promise<PlayingState | null>}
   */
export async function loadPlayingStateFromRedis(manager: any, guildId: string, voiceChannelId: string): Promise<PlayingState | null> {
  const stateData = await redisManager.loadPlayingState(guildId, voiceChannelId);
  if (stateData) {
    return stateData as PlayingState;
  }
  return null;
}


/**
   * Resume playing from crash recovery
   * @param {string} guildId - The guild ID
   */
export async function resumeFromCrash(manager: any, guildId: string): Promise<boolean> {
  const queue = manager.getQueue(guildId);
  if (!queue) {
    return false;
  }

  const playingState = await manager.loadPlayingStateFromRedis(guildId, queue.voiceChannel.id);
  if (!playingState) {
    Logger.debug(`No playing state found for guild ${guildId}, starting from queue beginning`);
    return false;
  }

  // Check if state is not too old (within 30 minutes)
  const now = Date.now();
  const stateAge = now - playingState.timestamp;
  if (stateAge > 30 * 60 * 1000) { // 30 minutes
    Logger.debug(`Playing state too old for guild ${guildId}, starting fresh`);
    await redisManager.deletePlayingState(guildId, queue.voiceChannel.id);
    return false;
  }

  // Convert serialized song back to Song object
  const currentSong: Song = {
    title: playingState.currentSong.title,
    url: playingState.currentSong.url,
    duration: playingState.currentSong.duration,
    thumbnail: playingState.currentSong.thumbnail,
    requestedBy: {
      id: playingState.currentSong.requestedBy.id,
      username: playingState.currentSong.requestedBy.username,
      displayAvatarURL: () => playingState.currentSong.requestedBy.displayAvatarURL,
    } as MinimalUser,
  } as Song;

  // Check if bot is still connected to voice channel
  if (!queue.connection) {
    Logger.debug(`No voice connection for guild ${guildId} during crash recovery, need to reconnect first`);
    return false;
  }

  const seekMs = playingState.playbackDurationMs || 0;

  // Check if this song is still in the queue (it should be the first one)
  if (queue.songs.length > 0 && queue.songs[0] && queue.songs[0].url === currentSong.url) {
    Logger.info(`Resuming crashed song for guild ${guildId} at ${seekMs}ms: ${currentSong.title}`);
    await manager.playNext(guildId, seekMs);
    return true;
  } else {
    // If the song is not the first in queue, try to find it and move it to front
    const songIndex = queue.songs.findIndex((song: SerializedSong) => song.url === currentSong.url);
    if (songIndex > 0) {
      // Move the crashed song to the front
      const [crashedSong] = queue.songs.splice(songIndex, 1);
      if (crashedSong) {
        queue.songs.unshift(crashedSong);
        Logger.info(`Found and moved crashed song to front for guild ${guildId} at ${seekMs}ms: ${crashedSong.title}`);
      }
      await manager.playNext(guildId, seekMs);
      return true;
    } else if (songIndex === -1) {
      // Song not found in queue, add it to the front
      queue.songs.unshift(currentSong);
      Logger.info(`Re-added crashed song to queue for guild ${guildId} at ${seekMs}ms: ${currentSong.title}`);
      await manager.playNext(guildId, seekMs);
      return true;
    }
  }

  return false;
}


/**
   * Automatically re-initialize queues and resume playback for all servers
   * @param {any} client - The Discord client
   */
export async function autoResumeAll(manager: any, client: any): Promise<void> {
  Logger.info('Starting auto-resume for all servers...');

  const playingStateKeys = await redisManager.getAllPlayingStateKeys();
  Logger.info(`Found ${playingStateKeys.length} active playing states`);

  for (const key of playingStateKeys) {
    // key format: prefix:playing:guildId:voiceChannelId
    const parts = key.split(':');
    if (parts.length < 4) continue;

    const guildId = parts[2];
    const voiceChannelId = parts[3];

    if (!guildId || !voiceChannelId) continue;

    try {
      const state = await redisManager.loadPlayingState(guildId, voiceChannelId);
      if (!state) continue;

      const playingState = state as PlayingState;

      // Skip if too old (> 30 mins)
      if (Date.now() - playingState.timestamp > 30 * 60 * 1000) {
        continue;
      }

      if (!playingState.textChannelId) {
        Logger.warn(`Cannot auto-resume guild ${guildId}: missing textChannelId`);
        continue;
      }

      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) continue;

      const voiceChannel = await client.channels.fetch(voiceChannelId).catch(() => null);
      const textChannel = await client.channels.fetch(playingState.textChannelId).catch(() => null);

      if (!voiceChannel || !textChannel || !voiceChannel.isVoiceBased()) {
        Logger.warn(`Cannot auto-resume guild ${guildId}: channels not found or invalid`);
        continue;
      }

      Logger.info(`Auto-resuming in guild ${guildId}`);
      await manager.createQueue(guildId, voiceChannel, textChannel as unknown as any);
      await manager.resumeFromCrash(guildId);
    } catch (error) {
      Logger.error(`Failed to auto-resume guild ${guildId}:`, error as Error);
    }
  }
}
