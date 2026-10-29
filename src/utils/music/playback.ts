/* eslint-disable valid-jsdoc, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { Logger } from '@/utils/logger';

import { redisManager } from '../redis';

import { backgroundDownloader } from '../backgroundDownloader';

import { Song } from '@/types/music';

import { createAudioResource, StreamType } from '@discordjs/voice';

import { cachedMp3Path, createYtdlpAudioStream, getRelatedVideo } from '@/utils/ytdlp';

import { createReadStream, existsSync } from 'fs';

import { spawn } from 'child_process';

import { deleteNowPlaying, refreshNowPlaying, retireNowPlaying, showNowPlaying } from './nowPlaying';

/**
   * Play the next song in the queue.
   * @param {string} guildId - The guild ID.
   */
export async function playNext(manager: any, guildId: string, seekMs: number = 0): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (!queue) return;
  queue.stopped = false;

  if (queue.songs.length === 0) {
    if (queue.autoplay && queue.lastSong) {
      Logger.info(`Autoplay: Finding related song for ${queue.lastSong.title}`);
      try {
        // A manually queued song re-seeds the radio from itself.
        if (queue.radioPickUrl !== queue.lastSong.url) queue.radioPool = [];
        const related = await getRelatedVideo(
          queue.lastSong.url,
          queue.lastSong.title,
          queue.history,
          queue.radioPool,
        );
        if (related) {
          queue.radioPickUrl = related.url;
          const song: Song = {
            title: related.title,
            url: related.url,
            duration: related.duration,
            thumbnail: related.thumbnail,
            requestedBy: queue.lastSong.requestedBy,
          };
          queue.songs.push(song);
          Logger.info(`Autoplay: Added ${song.title} to queue`);
          return manager.playNext(guildId);
        }
      } catch (error) {
        Logger.error('Autoplay failed:', error as Error);
      }
    }

    Logger.info(`No more songs in queue for guild ${guildId}`);
    await retireNowPlaying(queue);
    return;
  }

  // Check if bot is still connected to voice channel
  if (!queue.connection) {
    Logger.warn(`No voice connection for guild ${guildId}, cannot play music`);
    return;
  }

  const song = queue.songs.shift();
  if (!song) return;

  // Same song continuing after a broken stream keeps its Now Playing message.
  const isStreamResume = seekMs > 0 && !!queue.nowPlayingMessage && queue.lastSong?.url === song.url;

  // Update last played song
  queue.lastSong = song;
  queue.seekOffsetMs = seekMs;
  queue.streamFailed = undefined;
  if (seekMs === 0) queue.streamResumes = 0;

  // Add to history and keep max 20
  if (song.url) {
    queue.history.push(song.url);
    if (queue.history.length > 20) {
      queue.history.shift();
    }
    // Save queue state to persist history updates
    await manager.saveQueue(guildId).catch((err: any) =>
      Logger.error('Failed to save queue during playNext', err),
    );
  }

  try {
    Logger.debug(`musicManager.playNext: song.title="${song.title}", url=${song.url}`);

    if (!song.url) {
      throw new Error(`Invalid or undefined song URL: ${song.url ?? 'undefined'}`);
    }

    const filePath = cachedMp3Path(song.url);

    // Cached songs play from disk; anything else streams straight away while the
    // background downloader caches queued songs for later.
    let resource;
    if (!existsSync(filePath)) {
      Logger.info(`Streaming: ${song.title}${seekMs > 0 ? ` from ${seekMs / 1000}s` : ''}`);
      const result = createYtdlpAudioStream(song.url, seekMs);
      await result.ready;
      queue.streamFailed = result.failed;
      resource = createAudioResource(result.stream, { inputType: StreamType.Raw });
    } else if (seekMs > 0) {
      const seekSeconds = seekMs / 1000;
      Logger.info(`Seeking to ${seekSeconds}s for ${song.title}`);
      const ffmpeg = spawn('ffmpeg', [
        '-ss', seekSeconds.toString(),
        '-i', filePath,
        '-f', 'mp3',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1',
      ]);
      ffmpeg.stderr.on('data', (_d) => {});
      resource = createAudioResource(ffmpeg.stdout);
      ffmpeg.stdout.on('close', () => {
        try {
          ffmpeg.kill();
        } catch (e) {}
      });
    } else {
      resource = createAudioResource(createReadStream(filePath));
    }

    queue.player?.play(resource);
    Logger.debug(`musicManager.playNext: playing ${song.url} for guild ${guildId}`);

    // Save current playing state to Redis for crash recovery
    await manager.savePlayingStateToRedis(
      guildId,
      queue.voiceChannel.id,
      song,
      true,
      (queue.textChannel as unknown as { id?: string }).id,
      queue.seekOffsetMs,
    );

    if (!isStreamResume) await showNowPlaying(queue, song);
  } catch (error) {
    Logger.error(
      `Error playing song in guild ${guildId}: url=${song?.url ?? 'n/a'}`,
        error as Error,
    );

    let errorMessage = '❌ An error occurred while trying to play this song. Skipping...';
    if (error instanceof Error) {
      if (/video (is )?unavailable/i.test(error.message)) {
        errorMessage = '❌ Video unavailable or private. Skipping to next song...';
      } else if (error.message.includes('Could not extract')) {
        errorMessage = '❌ Unable to extract audio. Skipping to next song...';
      } else if (error.message.includes('Age restricted')) {
        errorMessage = '❌ Age-restricted video. Skipping to next song...';
      } else if (error.message.includes('yt-dlp stream failed')) {
        errorMessage = '❌ Failed to stream audio. Skipping to next song...';
      }
    }

    // Drop a stale "Starting..." placeholder or the previous song's message.
    await deleteNowPlaying(queue);
    await queue.textChannel.send({
      content: `${errorMessage}\n**${song.title}**`,
    } as unknown as import('discord.js').MessageCreateOptions);
    manager.playNext(guildId);
  }
}


/**
   * Skip the current song.
   * @param {string} guildId - The guild ID.
   */
export function skip(manager: any, guildId: string): void {
  const queue = manager.getQueue(guildId);
  if (queue?.player) {
    queue.player.stop();
  }
}


/**
   * Pause the current song.
   * @param {string} guildId - The guild ID.
   */
export function pause(manager: any, guildId: string): void {
  const queue = manager.getQueue(guildId);
  if (queue?.player) {
    queue.player.pause();
    queue.playing = false;
    Logger.debug(`Paused music in guild ${guildId}`);
    void refreshNowPlaying(queue);
  }
}


/**
   * Resume the current song.
   * @param {string} guildId - The guild ID.
   */
export function resume(manager: any, guildId: string): void {
  const queue = manager.getQueue(guildId);
  if (queue?.stopped) {
    // Stopped, not paused: start the preserved queue again.
    void manager.playNext(guildId);
    return;
  }
  if (queue?.player) {
    queue.player.unpause();
    queue.playing = true;
    Logger.debug(`Resumed music in guild ${guildId}`);
    void refreshNowPlaying(queue);
  }
}


/**
   * Stop playing music without clearing the queue.
   * @param {string} guildId - The guild ID.
   */
export async function stop(manager: any, guildId: string): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (queue?.player) {
    // Tells the Idle handler not to advance to the next song.
    queue.stopped = true;
    queue.player.stop();
    queue.playing = false;
    await retireNowPlaying(queue);

    // Clear playing state from Redis since we stopped
    await redisManager.deletePlayingState(guildId, queue.voiceChannel.id);
  }
}


/**
   * Disconnect from voice channel but preserve queue for later resume
   * @param {string} guildId - The guild ID.
   */
export async function disconnectVoice(manager: any, guildId: string): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (queue?.connection) {
    // Stop rather than pause: /play starts fresh, and /resume continues the song
    // from the Redis playing state, which the Idle handler leaves alone when stopped.
    if (queue.player) {
      queue.stopped = true;
      queue.player.stop();
      queue.playing = false;
    }
    await retireNowPlaying(queue);

    // Disconnect from voice
    queue.connection.destroy();
    queue.connection = null;

    Logger.info(`Disconnected from voice channel in guild ${guildId}, queue preserved`);
  }
}


/**
   * Check if voice channel is empty (no non-bot members)
   * @param {string} guildId - The guild ID.
   * @return {boolean} True if voice channel is empty
   */
export function isVoiceChannelEmpty(manager: any, guildId: string): boolean {
  const queue = manager.getQueue(guildId);
  if (!queue?.connection) {
    return true; // No connection means effectively empty
  }

  const voiceChannel = queue.voiceChannel;
  const nonBotMembers = voiceChannel.members.filter((member: any) => !member.user.bot);

  return nonBotMembers.size === 0;
}


/**
   * Leave voice channel and completely clear all queue data
   * @param {string} guildId - The guild ID.
   */
export async function leaveVoice(manager: any, guildId: string): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (!queue) {
    return; // No queue to clear
  }

  // Stop any playing music
  if (queue.player) {
    queue.stopped = true;
    queue.player.stop();
  }

  // Disconnect from voice channel
  if (queue.connection) {
    queue.connection.destroy();
  }

  await retireNowPlaying(queue);

  // Clear background downloads for this guild
  backgroundDownloader.clearGuildQueue(guildId);

  // Clear all Redis data for this queue
  await redisManager.deleteQueue(guildId, queue.voiceChannel.id);
  await redisManager.deletePlayingState(guildId, queue.voiceChannel.id);

  // Remove the queue from memory
  manager.queues.delete(guildId);

  Logger.info(`Left voice channel and cleared all data for guild ${guildId}`);
}
