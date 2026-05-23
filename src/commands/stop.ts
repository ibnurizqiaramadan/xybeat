import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { validateVoiceConnection } from '@/utils/commandHelper';
import { musicManager } from '@/utils/musicManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playing music (queue will be preserved)'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) return;

    const voiceChannel = await validateVoiceConnection(interaction, true);
    if (!voiceChannel) return;

    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue) {
      const { MessageFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ There is no music queue!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await musicManager.stop(interaction.guild.id);
    await interaction.reply({
      content: '⏹️ Stopped playing music. Queue preserved - use `/play` to resume or `/clear` to clear the queue.',
    });
  },
};

export default command;
