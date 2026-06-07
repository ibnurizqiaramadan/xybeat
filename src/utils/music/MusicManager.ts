/* eslint-disable valid-jsdoc, require-jsdoc, func-call-spacing, @typescript-eslint/no-explicit-any */
import { MusicQueue, Song, MusicManager } from '@/types/music';
import { VoiceBasedChannel } from 'discord.js';
import { Logger } from '@/utils/logger';
import { generateDependencyReport } from '@discordjs/voice';
import * as state from './state';
import * as playback from './playback';
import * as queue from './queue';
import { DownloadProgress } from '@/utils/ytdlp';
import { PlayingState } from './types';

class MusicManagerImpl implements MusicManager {
  public queues = new Map<string, MusicQueue>();
  public progressCallbacks = new Map<string, (progress: DownloadProgress) => void>();

  constructor() {
    Logger.info('Voice dependencies report:', generateDependencyReport());
    setInterval(() => state.updatePlaybackStates(this), 5000);
  }

  /**
   * Create a new music queue for a guild.
   * @param {string} guildId - The guild ID.
   * @param {VoiceBasedChannel} voiceChannel - The voice channel to connect to.
   * @param {object} textChannel - The text channel for updates.
   * @return {Promise<MusicQueue>} The created queue.
   */
  async createQueue(guildId: string, voiceChannel: VoiceBasedChannel, textChannel: MusicQueue['textChannel']): Promise<MusicQueue> {
    return queue.createQueue(this, guildId, voiceChannel, textChannel);
  }

  /**
   * Get the music queue for a guild.
   * @param {string} guildId - The guild ID.
   * @return {MusicQueue | undefined} The queue or undefined.
   */
  getQueue(guildId: string): MusicQueue | undefined {
    return queue.getQueue(this, guildId);
  }

  /**
   * Delete the music queue for a guild.
   * @param {string} guildId - The guild ID.
   */
  deleteQueue(guildId: string): void {
    return queue.deleteQueue(this, guildId);
  }

  /**
   * Play the next song in the queue.
   * @param {string} guildId - The guild ID.
   */
  async playNext(guildId: string, seekMs: number = 0): Promise<void> {
    return playback.playNext(this, guildId, seekMs);
  }

  /**
   * Set progress callback for a guild
   * @param {string} guildId - The guild ID
   * @param {Function} callback - Progress callback function
   */
  setProgressCallback(guildId: string, callback: (progress: DownloadProgress) => void): void {
    return queue.setProgressCallback(this, guildId, callback);
  }

  /**
   * Remove progress callback for a guild
   * @param {string} guildId - The guild ID
   */
  removeProgressCallback(guildId: string): void {
    return queue.removeProgressCallback(this, guildId);
  }

  /**
   * Save queue to Redis if enabled
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   */
  async saveQueue(guildId: string): Promise<void> {
    return state.saveQueue(this, guildId);
  }

  /**
   * Load queue from Redis if available
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   * @return {Promise<Song[]>}
   */
  async loadQueueFromRedis(guildId: string, voiceChannelId: string): Promise<{ songs: Song[]; autoplay: boolean; history: string[] }> {
    return state.loadQueueFromRedis(this, guildId, voiceChannelId);
  }

  /**
   * Save current playing state to Redis
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   * @param {Song} currentSong - Currently playing song
   * @param {boolean} isPlaying - Whether music is currently playing
   */
  async savePlayingStateToRedis(guildId: string, voiceChannelId: string, currentSong: Song, isPlaying: boolean, textChannelId?: string, playbackDurationMs?: number): Promise<void> {
    return state.savePlayingStateToRedis(this, guildId, voiceChannelId, currentSong, isPlaying, textChannelId, playbackDurationMs);
  }

  /**
   * Load current playing state from Redis
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   * @return {Promise<PlayingState | null>}
   */
  async loadPlayingStateFromRedis(guildId: string, voiceChannelId: string): Promise<PlayingState | null> {
    return state.loadPlayingStateFromRedis(this, guildId, voiceChannelId);
  }

  /**
   * Resume playing from crash recovery
   * @param {string} guildId - The guild ID
   */
  async resumeFromCrash(guildId: string): Promise<boolean> {
    return state.resumeFromCrash(this, guildId);
  }

  /**
   * Add a song to the queue and start playing if not already playing.
   * @param {string} guildId - The guild ID.
   * @param {Song} song - The song to add.
   */
  async addSong(guildId: string, song: Song): Promise<void> {
    return queue.addSong(this, guildId, song);
  }

  /**
   * Add multiple songs to the queue at once.
   * @param {string} guildId - The guild ID.
   * @param {Song[]} songs - The songs to add.
   */
  async addSongs(guildId: string, songs: Song[]): Promise<void> {
    return queue.addSongs(this, guildId, songs);
  }

  /**
   * Trigger background downloads for songs in the queue.
   * @param {string} guildId - The guild ID.
   */
  triggerBackgroundDownloads(guildId: string): void {
    return queue.triggerBackgroundDownloads(this, guildId);
  }

  /**
   * Skip the current song.
   * @param {string} guildId - The guild ID.
   */
  skip(guildId: string): void {
    return playback.skip(this, guildId);
  }

  /**
   * Pause the current song.
   * @param {string} guildId - The guild ID.
   */
  pause(guildId: string): void {
    return playback.pause(this, guildId);
  }

  /**
   * Resume the current song.
   * @param {string} guildId - The guild ID.
   */
  resume(guildId: string): void {
    return playback.resume(this, guildId);
  }

  /**
   * Stop playing music without clearing the queue.
   * @param {string} guildId - The guild ID.
   */
  async stop(guildId: string): Promise<void> {
    return playback.stop(this, guildId);
  }

  /**
   * Clear the music queue completely.
   * @param {string} guildId - The guild ID.
   */
  async clearQueue(guildId: string): Promise<void> {
    return queue.clearQueue(this, guildId);
  }

  /**
   * Disconnect from voice channel but preserve queue for later resume
   * @param {string} guildId - The guild ID.
   */
  async disconnectVoice(guildId: string): Promise<void> {
    return playback.disconnectVoice(this, guildId);
  }

  /**
   * Check if voice channel is empty (no non-bot members)
   * @param {string} guildId - The guild ID.
   * @return {boolean} True if voice channel is empty
   */
  isVoiceChannelEmpty(guildId: string): boolean {
    return playback.isVoiceChannelEmpty(this, guildId);
  }

  /**
   * Shuffle the queue using Fisher-Yates algorithm
   * @param {string} guildId - The guild ID.
   * @return {number} Number of songs shuffled
   */
  async shuffleQueue(guildId: string): Promise<number> {
    return queue.shuffleQueue(this, guildId);
  }

  /**
   * Leave voice channel and completely clear all queue data
   * @param {string} guildId - The guild ID.
   */
  async leaveVoice(guildId: string): Promise<void> {
    return playback.leaveVoice(this, guildId);
  }

  /**
   * Automatically re-initialize queues and resume playback for all servers
   * @param {any} client - The Discord client
   */
  async autoResumeAll(client: any): Promise<void> {
    return state.autoResumeAll(this, client);
  }
}

export const musicManager = new MusicManagerImpl();
