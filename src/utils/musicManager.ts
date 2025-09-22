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
import { redisManager } from './redis';

interface SerializedSong {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
  requestedBy: {
    id: string;
    username: string;
    displayAvatarURL: string;
  };
}

interface PlayingState {
  currentSong: SerializedSong;
  isPlaying: boolean;
  timestamp: number; // When this state was saved
}

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
   * @return {Promise<MusicQueue>} The created queue.
   */
  async createQueue(
    guildId: string,
    voiceChannel: VoiceBasedChannel,
    textChannel: MusicQueue['textChannel'],
  ): Promise<MusicQueue> {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    const player = createAudioPlayer();

    // Load existing queue from Redis if available
    const existingSongs = await this.loadQueueFromRedis(guildId, voiceChannel.id);

    const queue: MusicQueue = {
      textChannel,
      voiceChannel,
      connection,
      songs: existingSongs,
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

    player.on(AudioPlayerStatus.Idle, async() => {
      queue.playing = false;

      // Clear current playing state when song ends
      await redisManager.deletePlayingState(guildId, voiceChannel.id);

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

      // Save current playing state to Redis for crash recovery
      await this.savePlayingStateToRedis(guildId, queue.voiceChannel.id, song, true);

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
   * Save queue to Redis if enabled
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   */
  private async saveQueueToRedis(guildId: string, voiceChannelId: string): Promise<void> {
    const queue = this.getQueue(guildId);
    if (queue && queue.songs.length > 0) {
      // Convert songs to serializable format
      const serializableSongs: SerializedSong[] = queue.songs.map((song) => ({
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

      await redisManager.saveQueue(guildId, voiceChannelId, serializableSongs);
    }
  }

  /**
   * Load queue from Redis if available
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   * @return {Promise<Song[]>}
   */
  private async loadQueueFromRedis(guildId: string, voiceChannelId: string): Promise<Song[]> {
    const queueData = await redisManager.loadQueue(guildId, voiceChannelId);
    if (queueData && Array.isArray(queueData)) {
      return queueData.map((songData: any) => ({
        title: songData.title,
        url: songData.url,
        duration: songData.duration,
        thumbnail: songData.thumbnail,
        requestedBy: {
          id: songData.requestedBy.id,
          username: songData.requestedBy.username,
          displayAvatarURL: () => songData.requestedBy.displayAvatarURL,
        } as any,
      }));
    }
    return [];
  }

  /**
   * Save current playing state to Redis
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   * @param {Song} currentSong - Currently playing song
   * @param {boolean} isPlaying - Whether music is currently playing
   */
  private async savePlayingStateToRedis(
    guildId: string,
    voiceChannelId: string,
    currentSong: Song,
    isPlaying: boolean,
  ): Promise<void> {
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
    };

    await redisManager.savePlayingState(guildId, voiceChannelId, playingState);
  }

  /**
   * Load current playing state from Redis
   * @param {string} guildId - The guild ID
   * @param {string} voiceChannelId - The voice channel ID
   * @return {Promise<PlayingState | null>}
   */
  private async loadPlayingStateFromRedis(guildId: string, voiceChannelId: string): Promise<PlayingState | null> {
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
  async resumeFromCrash(guildId: string): Promise<boolean> {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return false;
    }

    const playingState = await this.loadPlayingStateFromRedis(guildId, queue.voiceChannel.id);
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
      } as any,
    };

    // Check if this song is still in the queue (it should be the first one)
    if (queue.songs.length > 0 && queue.songs[0] && queue.songs[0].url === currentSong.url) {
      Logger.info(`Resuming crashed song for guild ${guildId}: ${currentSong.title}`);
      await this.playNext(guildId);
      return true;
    } else {
      // If the song is not the first in queue, try to find it and move it to front
      const songIndex = queue.songs.findIndex((song) => song.url === currentSong.url);
      if (songIndex > 0) {
        // Move the crashed song to the front
        const [crashedSong] = queue.songs.splice(songIndex, 1);
        if (crashedSong) {
          queue.songs.unshift(crashedSong);
          Logger.info(`Found and moved crashed song to front for guild ${guildId}: ${crashedSong.title}`);
        }
        await this.playNext(guildId);
        return true;
      } else if (songIndex === -1) {
        // Song not found in queue, add it to the front
        queue.songs.unshift(currentSong);
        Logger.info(`Re-added crashed song to queue for guild ${guildId}: ${currentSong.title}`);
        await this.playNext(guildId);
        return true;
      }
    }

    return false;
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

    // Save to Redis if enabled
    await this.saveQueueToRedis(guildId, queue.voiceChannel.id);

    if (!queue.playing && queue.songs.length === 1) {
      // Try to resume from crash first
      const resumed = await this.resumeFromCrash(guildId);
      if (!resumed) {
        await this.playNext(guildId);
      }
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
   * Stop playing music without clearing the queue.
   * @param {string} guildId - The guild ID.
   */
  async stop(guildId: string): Promise<void> {
    const queue = this.getQueue(guildId);
    if (queue?.player) {
      queue.player.stop();
      queue.playing = false;

      // Clear playing state from Redis since we stopped
      await redisManager.deletePlayingState(guildId, queue.voiceChannel.id);
    }
  }

  /**
   * Clear the music queue completely.
   * @param {string} guildId - The guild ID.
   */
  async clearQueue(guildId: string): Promise<void> {
    const queue = this.getQueue(guildId);
    if (queue) {
      queue.songs = [];
      queue.playing = false;
      if (queue.player) {
        queue.player.stop();
      }

      // Remove both queue and playing state from Redis
      await redisManager.deleteQueue(guildId, queue.voiceChannel.id);
      await redisManager.deletePlayingState(guildId, queue.voiceChannel.id);
    }
  }
}

export const musicManager = new MusicManagerImpl();
