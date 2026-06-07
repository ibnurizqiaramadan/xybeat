import { CommandInteraction, EmbedBuilder, VoiceBasedChannel } from 'discord.js';
import { Logger } from '@/utils/logger';
import { getVideoInfo } from '@/utils/youtube';
import { Song, MinimalTextChannel } from '@/types/music';
import { musicManager } from '@/utils/music';
import { setupDownloadProgressCallback } from './progress';

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
