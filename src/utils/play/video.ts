import { CommandInteraction, EmbedBuilder, VoiceBasedChannel } from 'discord.js';
import { Logger } from '@/utils/logger';
import { getVideoInfo, VideoInfo } from '@/utils/youtube';
import { Song, MinimalTextChannel } from '@/types/music';
import { musicManager } from '@/utils/music';
import { retireNowPlaying } from '@/utils/music/nowPlaying';

/**
 * Handles single video play request
 * @param {string} url - Video URL
 * @param {CommandInteraction} interaction - Command interaction
 * @param {VoiceBasedChannel} voiceChannel - Connected voice channel
 * @param {VideoInfo} knownInfo - Info already fetched by a search, skips a second extraction
 */
export async function handleSingleVideo(
  url: string,
  interaction: CommandInteraction,
  voiceChannel: VoiceBasedChannel,
  knownInfo?: VideoInfo,
): Promise<void> {
  if (!interaction.guild) return;

  Logger.debug(`play: fetching video_info for url=${url}`);
  let videoInfo = knownInfo;
  try {
    videoInfo ??= await getVideoInfo(url);
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

  if (!queue.playing && queue.songs.length === 0) {
    // Starts right away: this reply becomes a placeholder that the Now Playing
    // message replaces, instead of a separate "Added to Queue" message.
    await retireNowPlaying(queue);
    await interaction.editReply({ content: `⏳ Starting **${song.title}**...`, embeds: [] });
    const placeholder = await interaction.fetchReply();
    queue.nowPlayingMessage = {
      id: placeholder.id,
      edit: (options) => interaction.editReply(options),
      delete: () => interaction.deleteReply(),
    };
  } else {
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Added to Queue')
      .setDescription(`**${song.title}**`)
      .addFields(
        { name: 'Duration', value: song.duration, inline: true },
        { name: 'Position in Queue', value: (queue.songs.length + 1).toString(), inline: true },
        { name: 'Requested by', value: song.requestedBy.username, inline: true },
      )
      .setThumbnail(song.thumbnail)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  // Add song to queue (this may trigger download if first song)
  Logger.debug(`Adding song to queue. Current queue length: ${queue.songs.length}`);
  await musicManager.addSong(interaction.guild.id, song);
  Logger.debug(`play: queued song for guild=${interaction.guild.id}, title="${song.title}"`);
  Logger.debug(`Queue length after adding: ${queue.songs.length}`);
}
