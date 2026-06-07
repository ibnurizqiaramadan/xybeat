/* eslint-disable valid-jsdoc, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { Logger } from '@/utils/logger';

import { redisManager } from '../redis';

import { backgroundDownloader } from '../backgroundDownloader';

import { MusicQueue, Song } from '@/types/music';

import { createAudioResource, AudioPlayerStatus } from '@discordjs/voice';

import { downloadYouTubeToMp3, getRelatedVideo } from '@/utils/ytdlp';

import { createReadStream, existsSync } from 'fs';

import { spawn } from 'child_process';

import { savePlayingStateToRedis, saveQueue } from './state';

import { triggerBackgroundDownloads } from './queue';
import { VoiceBasedChannel } from 'discord.js';

/**
   * Play the next song in the queue.
   * @param {string} guildId - The guild ID.
   */
export async function playNext(manager: any, guildId: string, seekMs: number = 0): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (!queue) return;

  if (queue.songs.length === 0) {
    if (queue.autoplay && queue.lastSong) {
      Logger.info(`Autoplay: Finding related song for ${queue.lastSong.title}`);
      try {
        const related = await getRelatedVideo(queue.lastSong.url, queue.history);
        if (related) {
          const song: Song = {
            title: related.title,
            url: related.url,
            duration: related.duration,
            thumbnail: related.thumbnail,
            requestedBy: queue.lastSong.requestedBy,
          };
          queue.songs.push(song);
          Logger.info(`Autoplay: Added ${song.title} to queue`);
          await queue.textChannel.send({
            content: `🔄 **Autoplay:** Found a related song: **${song.title}**`,
          } as unknown as import('discord.js').MessageCreateOptions);
          return manager.playNext(guildId);
        }
      } catch (error) {
        Logger.error('Autoplay failed:', error as Error);
      }
    }

    Logger.info(`No more songs in queue for guild ${guildId}`);
    return;
  }

  // Check if bot is still connected to voice channel
  if (!queue.connection) {
    Logger.warn(`No voice connection for guild ${guildId}, cannot play music`);
    return;
  }

  const song = queue.songs.shift();
  if (!song) return;

  // Update last played song
  queue.lastSong = song;
  queue.seekOffsetMs = seekMs;

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

    // Download MP3 file first using native yt-dlp
    Logger.info(`Downloading MP3 for: ${song.title}`);
    const progressCallback = manager.progressCallbacks.get(guildId);
    Logger.debug(`Progress callback ${progressCallback ? 'found' : 'NOT found'} for guild: ${guildId}`);
    const downloadResult = await downloadYouTubeToMp3(song.url, progressCallback);

    // Remove progress callback after download completes
    if (progressCallback) {
      Logger.debug(`Removing progress callback after download complete for guild: ${guildId}`);
      manager.removeProgressCallback(guildId);
    }

    // Ensure file exists before attempting to play
    if (!existsSync(downloadResult.filePath)) {
      throw new Error(`Downloaded file not found: ${downloadResult.filePath}`);
    }

    Logger.info(`MP3 downloaded successfully: ${downloadResult.filePath}`);

    // Create audio resource from the downloaded MP3 file
    let resource;
    if (seekMs > 0) {
      const seekSeconds = seekMs / 1000;
      Logger.info(`Seeking to ${seekSeconds}s for ${song.title}`);
      const ffmpeg = spawn('ffmpeg', [
        '-ss', seekSeconds.toString(),
        '-i', downloadResult.filePath,
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
      const audioStream = createReadStream(downloadResult.filePath);
      resource = createAudioResource(audioStream);
    }

    queue.player?.play(resource);
    Logger.debug(
      `musicManager.playNext: playing MP3 file ${downloadResult.filePath} for guild ${guildId}`,
    );

    // Save current playing state to Redis for crash recovery
    await manager.savePlayingStateToRedis(
      guildId,
      queue.voiceChannel.id,
      song,
      true,
      (queue.textChannel as unknown as { id?: string }).id,
      queue.seekOffsetMs,
    );

    const embed = {
      color: 0x0099ff,
      title: '🎵 Now Playing',
      description: `**${song.title}**`,
      fields: [
        {
          name: 'Duration',
          value: song.duration,
          inline: true,
        },
        {
          name: 'Requested by',
          value: song.requestedBy.username,
          inline: true,
        },
      ],
      thumbnail: {
        url: song.thumbnail,
      },
    };

    await queue.textChannel.send({
      embeds: [embed],
    } as unknown as import('discord.js').MessageCreateOptions);
  } catch (error) {
    Logger.error(
      `Error playing song in guild ${guildId}: url=${song?.url ?? 'n/a'}`,
        error as Error,
    );

    let errorMessage = '❌ An error occurred while trying to play this song. Skipping...';
    if (error instanceof Error) {
      if (error.message.includes('Video unavailable')) {
        errorMessage = '❌ Video unavailable or private. Skipping to next song...';
      } else if (error.message.includes('Could not extract')) {
        errorMessage = '❌ Unable to extract audio. Skipping to next song...';
      } else if (error.message.includes('Age restricted')) {
        errorMessage = '❌ Age-restricted video. Skipping to next song...';
      } else if (error.message.includes('Downloaded file not found')) {
        errorMessage = '❌ Failed to download audio file. Skipping to next song...';
      }
    }

    await queue.textChannel.send({
      content: errorMessage,
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
  }
}


/**
   * Resume the current song.
   * @param {string} guildId - The guild ID.
   */
export function resume(manager: any, guildId: string): void {
  const queue = manager.getQueue(guildId);
  if (queue?.player) {
    queue.player.unpause();
    queue.playing = true;
    Logger.debug(`Resumed music in guild ${guildId}`);
  }
}


/**
   * Stop playing music without clearing the queue.
   * @param {string} guildId - The guild ID.
   */
export async function stop(manager: any, guildId: string): Promise<void> {
  const queue = manager.getQueue(guildId);
  if (queue?.player) {
    queue.player.stop();
    queue.playing = false;

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
    // Pause any playing music
    if (queue.playing && queue.player) {
      queue.player.pause();
      queue.playing = false;
    }

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
    queue.player.stop();
  }

  // Disconnect from voice channel
  if (queue.connection) {
    queue.connection.destroy();
  }

  // Remove progress callback if any
  manager.removeProgressCallback(guildId);

  // Clear background downloads for this guild
  backgroundDownloader.clearGuildQueue(guildId);

  // Clear all Redis data for this queue
  await redisManager.deleteQueue(guildId, queue.voiceChannel.id);
  await redisManager.deletePlayingState(guildId, queue.voiceChannel.id);

  // Remove the queue from memory
  manager.queues.delete(guildId);

  Logger.info(`Left voice channel and cleared all data for guild ${guildId}`);
}
