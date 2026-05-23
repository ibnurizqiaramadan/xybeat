import {
  SlashCommandBuilder,
  CommandInteraction,
  ChatInputCommandInteraction,
} from 'discord.js';
import { Command } from '@/types';
import { validateVoiceConnection, validateBotPermissions } from '@/utils/commandHelper';
import { Logger } from '@/utils/logger';
import { isValidYouTubeUrl, isPlaylistUrl } from '@/utils/ytdlp';
import { resolveQuery, handlePlaylist, handleSingleVideo } from '@/utils/playHandlers';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play music from YouTube (supports videos and playlists)')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('YouTube URL, playlist URL, or search query')
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    Logger.debug('=== PLAY COMMAND STARTED ===');
    Logger.debug(`User: ${interaction.user.username}, Guild: ${interaction.guild?.name}`);

    if (!interaction.guild) return;

    const voiceChannel = await validateVoiceConnection(interaction, true);
    if (!voiceChannel) return;

    const hasPermissions = await validateBotPermissions(voiceChannel, interaction);
    if (!hasPermissions) return;

    Logger.debug('Deferring reply...');
    await interaction.deferReply();
    Logger.debug('Reply deferred successfully');

    // Send immediate response to prevent timeout
    await interaction.editReply({
      content: '🔍 Processing your request...',
    });

    const rawQuery = (interaction as ChatInputCommandInteraction).options.getString('query', true);
    const query = rawQuery
      .trim()
      .replace(/^@+/, '')
      .replace(/^<+|>+$/g, '');
    Logger.debug(`play: raw="${rawQuery}", sanitized="${query}"`);

    const url = await resolveQuery(query, interaction);
    if (!url) return;

    // Final guard to ensure url is a valid YouTube URL
    if (!isValidYouTubeUrl(url)) {
      Logger.debug(`play: final guard failed, url=${url}`);
      await interaction.editReply({
        content: '❌ Invalid YouTube URL detected after processing. Please try another link or query.',
      });
      return;
    }

    try {
      if (isPlaylistUrl(url)) {
        await handlePlaylist(url, interaction, voiceChannel);
      } else {
        await handleSingleVideo(url, interaction, voiceChannel);
      }
    } catch (error) {
      Logger.error('Error in play command', error as Error);
      let errorMessage = '❌ An error occurred while trying to play this song.';

      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('Video unavailable')) {
          errorMessage = '❌ This video is unavailable or private.';
        }
        if (msg.includes('Could not extract')) {
          errorMessage = '❌ Unable to extract audio from this video. Try another video.';
        }
        if (msg.includes('Age restricted')) {
          errorMessage = '❌ This video is age-restricted and cannot be played.';
        }
        if (msg.includes('playlist type is unviewable')) {
          errorMessage = '❌ This playlist type (YouTube Mix/Radio) cannot be accessed. Please use a regular playlist or single video.';
        }
      }

      await interaction.editReply({
        content: errorMessage,
      });
    }
  },
};

export default command;
