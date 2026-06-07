/* eslint-disable valid-jsdoc, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { Logger } from '@/utils/logger';

import { redisManager } from '../redis';

import { backgroundDownloader } from '../backgroundDownloader';

import { MusicQueue, Song } from '@/types/music';

import { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus } from '@discordjs/voice';


import { VoiceBasedChannel } from 'discord.js';
import { VoiceConnectionStatus } from '@discordjs/voice';
import { DownloadProgress } from '@/utils/ytdlp';

/**
   * Create a new music queue for a guild.
   * @param {string} guildId - The guild ID.
   * @param {VoiceBasedChannel} voiceChannel - The voice channel to connect to.
   * @param {object} textChannel - The text channel for updates.
   * @return {Promise<MusicQueue>} The created queue.
   */
export async function createQueue(manager: any, guildId: string, voiceChannel: VoiceBasedChannel, textChannel: MusicQueue['textChannel']): Promise<MusicQueue> {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  const player = createAudioPlayer();

  // Load existing queue from Redis if available
  const { songs: existingSongs, autoplay: savedAutoplay, history: savedHistory } = await manager.loadQueueFromRedis(guildId, voiceChannel.id);

  const queue: MusicQueue = {
    textChannel,
    voiceChannel,
    connection,
    songs: existingSongs,
    volume: 100,
    playing: false,
    player,
    autoplay: savedAutoplay,
    lastSong: null,
    history: savedHistory,
    seekOffsetMs: 0,
  };

  // Handle player events
  player.on(AudioPlayerStatus.Playing, () => {
    queue.playing = true;
    Logger.info(`Started playing audio in guild ${guildId}`);
  });
  player.on(AudioPlayerStatus.Buffering, () => {
    Logger.debug(`Buffering audio in guild ${guildId}`);
  });
  player.on(AudioPlayerStatus.AutoPaused, () => {
    Logger.debug(`AutoPaused audio in guild ${guildId}`);
  });

  player.on(AudioPlayerStatus.Idle, async() => {
    queue.playing = false;

    // Clear current playing state when song ends
    await redisManager.deletePlayingState(guildId, voiceChannel.id);

    manager.playNext(guildId);
  });

  player.on('error', (error) => {
    Logger.error(`Audio player error in guild ${guildId}:`, error);
    manager.playNext(guildId);
  });

  // Handle connection events
  connection.on(VoiceConnectionStatus.Ready, () => {
    Logger.info(`Voice connection ready in guild ${guildId}`);
    connection.subscribe(player);
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    Logger.info(`Voice connection disconnected in guild ${guildId}`);
    manager.deleteQueue(guildId);
  });

  manager.queues.set(guildId, queue);
  return queue;
}


/**
   * Get the music queue for a guild.
   * @param {string} guildId - The guild ID.
   * @return {MusicQueue | undefined} The queue or undefined.
   */
export function getQueue(manager: any, guildId: string): MusicQueue | undefined {
  return manager.queues.get(guildId);
}


/**
   * Delete the music queue for a guild.
   * @param {string} guildId - The guild ID.
   */
export function deleteQueue(manager: any, guildId: string): void {
  const queue = manager.queues.get(guildId);
  if (queue) {
    if (queue.connection) {
      queue.connection.destroy();
    }
    if (queue.player) {
      queue.player.stop();
    }
    manager.queues.delete(guildId);
    // Also remove progress callback
    manager.removeProgressCallback(guildId);
    Logger.info(`Deleted music queue for guild ${guildId}`);
  }
}


/**
   * Set progress callback for a guild
   * @param {string} guildId - The guild ID
   * @param {Function} callback - Progress callback function
   */
export function setProgressCallback(manager: any, guildId: string, callback: (progress: DownloadProgress) => void): void {
  Logger.debug(`Setting progress callback for guild: ${guildId}`);
  manager.progressCallbacks.set(guildId, callback);
}


/**
   * Remove progress callback for a guild
   * @param {string} guildId - The guild ID
   */
export function removeProgressCallback(manager: any, guildId: string): void {
  manager.progressCallbacks.delete(guildId);
}


/**
   * Add a song to the queue and start playing if not already playing.
   * @param {string} guildId - The guild ID.
   * @param {Song} song - The song to add.
   */
export async function addSong(manager: any, guildId: string, song: Song): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (!queue) return;

  queue.songs.push(song);

  // Save to Redis if enabled
  await manager.saveQueue(guildId);

  // Trigger background download for all songs in queue
  // Give higher priority to the next song in queue
  manager.triggerBackgroundDownloads(guildId);

  if (!queue.playing && queue.songs.length === 1) {
    // Try to resume from crash first
    const resumed = await manager.resumeFromCrash(guildId);
    if (!resumed) {
      await manager.playNext(guildId);
    }
  }
}


/**
   * Add multiple songs to the queue at once.
   * @param {string} guildId - The guild ID.
   * @param {Song[]} songs - The songs to add.
   */
export async function addSongs(manager: any, guildId: string, songs: Song[]): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (!queue) return;

  const wasEmpty = queue.songs.length === 0;
  queue.songs.push(...songs);

  // Save to Redis if enabled
  await manager.saveQueue(guildId);

  // Trigger background download for all new songs
  manager.triggerBackgroundDownloads(guildId);

  if (!queue.playing && wasEmpty && queue.songs.length > 0) {
    // Try to resume from crash first
    const resumed = await manager.resumeFromCrash(guildId);
    if (!resumed) {
      await manager.playNext(guildId);
    }
  }
}


/**
   * Trigger background downloads for songs in the queue.
   * @param {string} guildId - The guild ID.
   */
export function triggerBackgroundDownloads(manager: any, guildId: string): void {
  const queue = manager.getQueue(guildId);
  if (!queue || queue.songs.length === 0) return;

  // Download next 5 songs in queue with priority
  const songsToDownload = queue.songs.slice(0, 5);

  if (songsToDownload.length > 0) {
    // First song (next to play) gets highest priority
    const firstSong = songsToDownload[0];
    if (firstSong) {
      backgroundDownloader.addHighPriority(guildId, firstSong, 1);
    }

    // Rest of the songs get normal priority
    if (songsToDownload.length > 1) {
      backgroundDownloader.addToQueue(guildId, songsToDownload.slice(1), 10);
    }

    Logger.info(`Triggered background downloads for ${songsToDownload.length} songs in guild ${guildId}`);
  }
}


/**
   * Clear the music queue completely.
   * @param {string} guildId - The guild ID.
   */
export async function clearQueue(manager: any, guildId: string): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (queue) {
    queue.songs = [];
    queue.playing = false;
    if (queue.player) {
      queue.player.stop();
    }

    // Clear background downloads for this guild
    backgroundDownloader.clearGuildQueue(guildId);

    // Remove both queue and playing state from Redis
    await redisManager.deleteQueue(guildId, queue.voiceChannel.id);
    await redisManager.deletePlayingState(guildId, queue.voiceChannel.id);
  }
}


/**
   * Shuffle the queue using Fisher-Yates algorithm
   * @param {string} guildId - The guild ID.
   * @return {number} Number of songs shuffled
   */
export async function shuffleQueue(manager: any, guildId: string): Promise<number> {
  const queue = manager.getQueue(guildId);
  if (!queue || queue.songs.length <= 1) {
    return 0; // No queue or only one song, nothing to shuffle
  }

  // If music is currently playing, we want to keep the current song at position 0
  // and shuffle only the remaining songs
  const startIndex = queue.playing ? 1 : 0;
  const songsToShuffle = queue.songs.slice(startIndex);

  if (songsToShuffle.length <= 1) {
    return 0; // Nothing to shuffle
  }

  // Fisher-Yates shuffle algorithm
  for (let i = songsToShuffle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const songI = songsToShuffle[i];
    const songJ = songsToShuffle[j];
    if (songI && songJ) {
      songsToShuffle[i] = songJ;
      songsToShuffle[j] = songI;
    }
  }

  // Reconstruct the queue
  if (queue.playing && queue.songs[0]) {
    // Keep current playing song at front, shuffle the rest
    queue.songs = [queue.songs[0], ...songsToShuffle];
  } else {
    // Shuffle all songs
    queue.songs = songsToShuffle;
  }

  // Save shuffled queue to Redis
  await manager.saveQueue(guildId);

  // Retrigger background downloads with new order
  manager.triggerBackgroundDownloads(guildId);

  Logger.info(`Shuffled ${songsToShuffle.length} songs in guild ${guildId}`);
  return songsToShuffle.length;
}
