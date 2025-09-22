import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  generateDependencyReport,
} from '@discordjs/voice';
import { downloadYouTubeToMp3, DownloadProgress } from '@/utils/ytdlp';
import { MusicQueue, Song, MusicManager } from '@/types/music';
import { VoiceBasedChannel } from 'discord.js';
import { Logger } from '@/utils/logger';
import { createReadStream, existsSync } from 'fs';

/**
 * Implementation of the music manager for handling voice connections and audio playback.
 */
class MusicManagerImpl implements MusicManager {
  public queues = new Map<string, MusicQueue>();
  // eslint-disable-next-line func-call-spacing
  private progressCallbacks = new Map<string, (progress: DownloadProgress) => void>();

  /**
   * Initialize the music manager.
   */
  constructor() {
    // Log voice dependencies
    Logger.info('Voice dependencies report:', generateDependencyReport());
  }

  /**
   * Create a new music queue for a guild.
   * @param {string} guildId - The guild ID.
   * @param {VoiceBasedChannel} voiceChannel - The voice channel to connect to.
   * @param {object} textChannel - The text channel for updates.
   * @return {MusicQueue} The created queue.
   */
  createQueue(
    guildId: string,
    voiceChannel: VoiceBasedChannel,
    textChannel: MusicQueue['textChannel'],
  ): MusicQueue {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    const player = createAudioPlayer();

    const queue: MusicQueue = {
      textChannel,
      voiceChannel,
      connection,
      songs: [],
      volume: 100,
      playing: false,
      player,
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

    player.on(AudioPlayerStatus.Idle, () => {
      queue.playing = false;
      this.playNext(guildId);
    });

    player.on('error', (error) => {
      Logger.error(`Audio player error in guild ${guildId}:`, error);
      this.playNext(guildId);
    });

    // Handle connection events
    connection.on(VoiceConnectionStatus.Ready, () => {
      Logger.info(`Voice connection ready in guild ${guildId}`);
      connection.subscribe(player);
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      Logger.info(`Voice connection disconnected in guild ${guildId}`);
      this.deleteQueue(guildId);
    });

    this.queues.set(guildId, queue);
    return queue;
  }

  /**
   * Get the music queue for a guild.
   * @param {string} guildId - The guild ID.
   * @return {MusicQueue | undefined} The queue or undefined.
   */
  getQueue(guildId: string): MusicQueue | undefined {
    return this.queues.get(guildId);
  }

  /**
   * Delete the music queue for a guild.
   * @param {string} guildId - The guild ID.
   */
  deleteQueue(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (queue) {
      if (queue.connection) {
        queue.connection.destroy();
      }
      if (queue.player) {
        queue.player.stop();
      }
      this.queues.delete(guildId);
      // Also remove progress callback
      this.removeProgressCallback(guildId);
      Logger.info(`Deleted music queue for guild ${guildId}`);
    }
  }

  /**
   * Play the next song in the queue.
   * @param {string} guildId - The guild ID.
   */
  private async playNext(guildId: string): Promise<void> {
    const queue = this.getQueue(guildId);
    if (!queue || queue.songs.length === 0) {
      Logger.info(`No more songs in queue for guild ${guildId}`);
      return;
    }

    const song = queue.songs.shift();
    if (!song) return;

    try {
      Logger.debug(`musicManager.playNext: song.title="${song.title}", url=${song.url}`);

      if (!song.url) {
        throw new Error(`Invalid or undefined song URL: ${song.url ?? 'undefined'}`);
      }

      // Download MP3 file first using native yt-dlp
      Logger.info(`Downloading MP3 for: ${song.title}`);
      const progressCallback = this.progressCallbacks.get(guildId);
      Logger.debug(`Progress callback ${progressCallback ? 'found' : 'NOT found'} for guild: ${guildId}`);
      const downloadResult = await downloadYouTubeToMp3(song.url, progressCallback);

      // Remove progress callback after download completes
      if (progressCallback) {
        Logger.debug(`Removing progress callback after download complete for guild: ${guildId}`);
        this.removeProgressCallback(guildId);
      }

      // Ensure file exists before attempting to play
      if (!existsSync(downloadResult.filePath)) {
        throw new Error(`Downloaded file not found: ${downloadResult.filePath}`);
      }

      Logger.info(`MP3 downloaded successfully: ${downloadResult.filePath}`);

      // Create audio resource from the downloaded MP3 file
      const audioStream = createReadStream(downloadResult.filePath);
      const resource = createAudioResource(audioStream);

      queue.player?.play(resource);
      Logger.debug(
        `musicManager.playNext: playing MP3 file ${downloadResult.filePath} for guild ${guildId}`,
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
      this.playNext(guildId);
    }
  }

  /**
   * Set progress callback for a guild
   * @param {string} guildId - The guild ID
   * @param {Function} callback - Progress callback function
   */
  setProgressCallback(guildId: string, callback: (progress: DownloadProgress) => void): void {
    Logger.debug(`Setting progress callback for guild: ${guildId}`);
    this.progressCallbacks.set(guildId, callback);
  }

  /**
   * Remove progress callback for a guild
   * @param {string} guildId - The guild ID
   */
  removeProgressCallback(guildId: string): void {
    this.progressCallbacks.delete(guildId);
  }

  /**
   * Add a song to the queue and start playing if not already playing.
   * @param {string} guildId - The guild ID.
   * @param {Song} song - The song to add.
   */
  async addSong(guildId: string, song: Song): Promise<void> {
    const queue = this.getQueue(guildId);
    if (!queue) return;

    queue.songs.push(song);

    if (!queue.playing && queue.songs.length === 1) {
      await this.playNext(guildId);
    }
  }

  /**
   * Skip the current song.
   * @param {string} guildId - The guild ID.
   */
  skip(guildId: string): void {
    const queue = this.getQueue(guildId);
    if (queue?.player) {
      queue.player.stop();
    }
  }

  /**
   * Pause the current song.
   * @param {string} guildId - The guild ID.
   */
  pause(guildId: string): void {
    const queue = this.getQueue(guildId);
    if (queue?.player) {
      queue.player.pause();
    }
  }

  /**
   * Resume the current song.
   * @param {string} guildId - The guild ID.
   */
  resume(guildId: string): void {
    const queue = this.getQueue(guildId);
    if (queue?.player) {
      queue.player.unpause();
    }
  }

  /**
   * Stop playing and clear the queue.
   * @param {string} guildId - The guild ID.
   */
  stop(guildId: string): void {
    const queue = this.getQueue(guildId);
    if (queue) {
      queue.songs = [];
      if (queue.player) {
        queue.player.stop();
      }
    }
  }
}

export const musicManager = new MusicManagerImpl();
