import { CommandInteraction, EmbedBuilder, VoiceBasedChannel } from 'discord.js';
import { Logger } from '@/utils/logger';
import { getPlaylistInfo } from '@/utils/youtube';
import { Song, MinimalTextChannel } from '@/types/music';
import { musicManager } from '@/utils/music';
import { setupDownloadProgressCallback } from './progress';

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
