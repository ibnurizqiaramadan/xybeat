import { CommandInteraction, EmbedBuilder, VoiceBasedChannel } from 'discord.js';
import { Song, MinimalTextChannel } from '@/types/music';
import { Logger } from '@/utils/logger';
import {
  getVideoInfo,
  isValidYouTubeUrl,
  searchYouTube,
  getPlaylistInfo,
  DownloadProgress,
} from '@/utils/ytdlp';
import { musicManager } from '@/utils/musicManager';
import { createProgressEmbed } from '@/utils/playEmbeds';

/**
 * Resolves query by verifying if it is a valid URL or searching YouTube
 * @param {string} query - Clean query
 * @param {CommandInteraction} interaction - Command interaction
 * @return {Promise<string | null>} The resolved video/playlist URL, or null if error occurred
 */
export async function resolveQuery(query: string, interaction: CommandInteraction): Promise<string | null> {
  const isValidUrl = isValidYouTubeUrl(query);
  Logger.debug(`play: isValidYouTubeUrl(query)=${isValidUrl}`);

  if (isValidUrl) {
    return query;
  }

  // Try searching the query on YouTube
  Logger.debug(`play: searching for "${query}"`);
  const searchResult = await searchYouTube(query);
  if (!searchResult) {
    await interaction.editReply({
      content: '❌ No results found. Please provide a valid YouTube URL or query.',
    });
    return null;
  }

  Logger.debug(`play: found search result: ${searchResult.title}`);
  return searchResult.url;
}

/**
 * Sets up progress callback for downloading a song
 * @param {string} guildId - Guild ID
 * @param {string} title - Song title
 * @param {CommandInteraction} interaction - Command interaction
 */
export function setupDownloadProgressCallback(
  guildId: string,
  title: string,
  interaction: CommandInteraction,
): void {
  let lastProgressUpdate = 0;
  const progressCallback = async(progress: DownloadProgress) => {
    Logger.debug(`Progress callback triggered: ${progress.percentage}%`);

    // Update only every 2 seconds to avoid rate limiting
    const now = Date.now();
    const isFinished = progress.percentage >= 100 || progress.downloaded === 'Cached';
    if (!isFinished && now - lastProgressUpdate < 2000) {
      Logger.debug(`Progress update skipped (rate limit): ${progress.percentage}%`);
      return;
    }
    lastProgressUpdate = now;

    try {
      Logger.debug(`Updating progress embed: ${progress.percentage}%`);
      const progressEmbed = createProgressEmbed(title, progress);
      await interaction.editReply({ embeds: [progressEmbed] });
      Logger.debug('Progress embed updated successfully');

      // If download is complete (100% or cached), show final message after a short delay
      if (progress.percentage >= 100 || progress.downloaded === 'Cached') {
        Logger.debug('Download complete, will remove progress display shortly');
        setTimeout(async() => {
          try {
            const finalEmbed = new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle('✅ Ready to Play')
              .setDescription(`**${title}**`)
              .addFields(
                {
                  name: 'Status',
                  value: 'Download complete, starting playback...',
                  inline: false,
                },
              )
              .setTimestamp();

            await interaction.editReply({ embeds: [finalEmbed] });
            Logger.debug('Final download complete embed sent');
          } catch (error) {
            Logger.warn(`Failed to send final embed: ${(error as Error).message}`);
          }
        }, 1500); // Wait 1.5 seconds before showing final message
      }
    } catch (error) {
      Logger.warn(`Failed to update progress: ${(error as Error).message}`);
    }
  };

  // Set the progress callback for this guild
  musicManager.setProgressCallback(guildId, progressCallback);

  // Remove the callback after 5 minutes to prevent memory leaks
  setTimeout(() => {
    musicManager.removeProgressCallback(guildId);
  }, 5 * 60 * 1000);
}

/**
 * Handles playlist URL play request
 * @param {string} url - Playlist URL
 * @param {CommandInteraction} interaction - Command interaction
 * @param {VoiceBasedChannel} voiceChannel - Connected voice channel
 */
export async function handlePlaylist(
  url: string,
  interaction: CommandInteraction,
  voiceChannel: VoiceBasedChannel,
): Promise<void> {
  if (!interaction.guild) return;

  Logger.debug(`play: detected playlist URL, fetching playlist info for url=${url}`);
  const playlistVideos = await getPlaylistInfo(url);
  if (playlistVideos.length === 0) {
    await interaction.editReply({
      content: '❌ No videos found in this playlist or playlist is private.',
    });
    return;
  }

  Logger.debug(`play: found ${playlistVideos.length} videos in playlist`);

  // Get or create queue
  let queue = musicManager.getQueue(interaction.guild.id);
  if (!queue) {
    if (!interaction.channel) {
      await interaction.editReply({
        content: '❌ Could not access the text channel!',
      });
      return;
    }
    queue = await musicManager.createQueue(
      interaction.guild.id,
      voiceChannel,
      interaction.channel as unknown as MinimalTextChannel,
    );
  }

  // Set up progress callback for the first song if queue is empty
  const firstSong = playlistVideos[0];
  if (queue.songs.length === 0 && firstSong) {
    Logger.debug('Setting up progress callback for playlist first song');
    setupDownloadProgressCallback(interaction.guild.id, firstSong.title, interaction);
  }

  // Convert all videos to songs and add to queue efficiently
  const songs: Song[] = playlistVideos.map((videoInfo) => ({
    title: videoInfo.title,
    url: videoInfo.url,
    duration: videoInfo.duration,
    thumbnail: videoInfo.thumbnail,
    requestedBy: interaction.user,
  }));

  // Add all songs at once (triggers background downloading automatically)
  await musicManager.addSongs(interaction.guild.id, songs);

  Logger.debug(
    `play: queued ${playlistVideos.length} songs from playlist for guild=${interaction.guild.id}`,
  );

  // Check if it's actually a single video or a real playlist
  const video = playlistVideos[0];
  if (playlistVideos.length === 1 && video) {
    Logger.debug('Playlist fallback: showing single video embed');
    Logger.debug(`Single video from fallback: ${video.title}`);
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Added to Queue')
      .setDescription(`**${video.title}**`)
      .addFields(
        {
          name: 'Duration',
          value: video.duration,
          inline: true,
        },
        {
          name: 'Position in Queue',
          value: queue.songs.length.toString(),
          inline: true,
        },
        {
          name: 'Requested by',
          value: interaction.user.username,
          inline: true,
        },
      )
      .setThumbnail(video.thumbnail)
      .setTimestamp();

    Logger.debug('Sending single video embed...');
    await interaction.editReply({ embeds: [embed] });
    Logger.debug('Single video embed sent successfully');
    return;
  }

  // Multiple videos, show as playlist
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('📋 Playlist Added to Queue')
    .setDescription(`Added **${playlistVideos.length}** songs to the queue`)
    .addFields(
      {
        name: 'Total Songs',
        value: playlistVideos.length.toString(),
        inline: true,
      },
      {
        name: 'Queue Size',
        value: queue.songs.length.toString(),
        inline: true,
      },
      {
        name: 'Requested by',
        value: interaction.user.username,
        inline: true,
      },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handles single video play request
 * @param {string} url - Video URL
 * @param {CommandInteraction} interaction - Command interaction
 * @param {VoiceBasedChannel} voiceChannel - Connected voice channel
 */
export async function handleSingleVideo(
  url: string,
  interaction: CommandInteraction,
  voiceChannel: VoiceBasedChannel,
): Promise<void> {
  if (!interaction.guild) return;

  Logger.debug(`play: fetching video_info for url=${url}`);
  let videoInfo;
  try {
    videoInfo = await getVideoInfo(url);
    Logger.debug(`play: info.id=${videoInfo.id}, title="${videoInfo.title}"`);
    Logger.debug(`play: duration=${videoInfo.duration}, thumbnail=${!!videoInfo.thumbnail}`);
  } catch (videoInfoError) {
    Logger.error('Failed to get video info:', videoInfoError as Error);
    await interaction.editReply({
      content: '❌ Failed to get video information. Please try another video.',
    });
    return;
  }

  const song: Song = {
    title: videoInfo.title,
    url: videoInfo.url,
    duration: videoInfo.duration,
    thumbnail: videoInfo.thumbnail,
    requestedBy: interaction.user,
  };

  // Get or create queue
  let queue = musicManager.getQueue(interaction.guild.id);
  if (!queue) {
    if (!interaction.channel) {
      await interaction.editReply({
        content: '❌ Could not access the text channel!',
      });
      return;
    }
    queue = await musicManager.createQueue(
      interaction.guild.id,
      voiceChannel,
      interaction.channel as unknown as MinimalTextChannel,
    );
  }

  // Show initial "Added to Queue" message
  const initialEmbed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ Added to Queue')
    .setDescription(`**${song.title}**`)
    .addFields(
      {
        name: 'Duration',
        value: song.duration,
        inline: true,
      },
      {
        name: 'Position in Queue',
        value: (queue.songs.length + 1).toString(), // +1 because we haven't added yet
        inline: true,
      },
      {
        name: 'Requested by',
        value: song.requestedBy.username,
        inline: true,
      },
    )
    .setThumbnail(song.thumbnail)
    .setTimestamp();

  Logger.debug('Sending initial "Added to Queue" embed...');
  await interaction.editReply({ embeds: [initialEmbed] });
  Logger.debug('Initial embed sent successfully');

  // Set up progress callback BEFORE adding song to queue if first song
  if (queue.songs.length === 0) {
    setupDownloadProgressCallback(interaction.guild.id, song.title, interaction);
  }

  // Add song to queue (this may trigger download if first song)
  Logger.debug(`Adding song to queue. Current queue length: ${queue.songs.length}`);
  await musicManager.addSong(interaction.guild.id, song);
  Logger.debug(`play: queued song for guild=${interaction.guild.id}, title="${song.title}"`);
  Logger.debug(`Queue length after adding: ${queue.songs.length}`);
}
