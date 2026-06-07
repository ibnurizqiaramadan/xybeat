import {
  SlashCommandBuilder,
  CommandInteraction,
  ChatInputCommandInteraction,
} from 'discord.js';
import { Command } from '@/types';
import { validateVoiceConnection, validateBotPermissions } from '@/utils/commandHelper';
import { Logger } from '@/utils/logger';
import { handleSearch } from '@/utils/play';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a song and choose from multiple results')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('The song you want to search for')
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) return;

    const voiceChannel = await validateVoiceConnection(interaction, true);
    if (!voiceChannel) return;

    const hasPermissions = await validateBotPermissions(voiceChannel, interaction);
    if (!hasPermissions) return;

    await interaction.deferReply();

    const query = (interaction as ChatInputCommandInteraction).options.getString('query', true);
    Logger.debug(`search: query="${query}"`);

    try {
      await handleSearch(query, interaction, voiceChannel);
    } catch (error) {
      Logger.error('Error in search command', error as Error);
      await interaction.editReply({
        content: '❌ An error occurred while searching. Please try again later.',
      });
    }
  },
};

export default command;
