import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { validateVoiceConnection } from '@/utils/commandHelper';
import { musicManager } from '@/utils/musicManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear the entire music queue'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) return;

    const voiceChannel = await validateVoiceConnection(interaction, true);
    if (!voiceChannel) return;

    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue) {
      const { MessageFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ There is no music queue to clear!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (queue.songs.length === 0) {
      const { MessageFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ The queue is already empty!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const queueLength = queue.songs.length;
    await musicManager.clearQueue(interaction.guild.id);

    await interaction.reply({
      content: `🗑️ Cleared the queue! Removed ${queueLength} song${queueLength === 1 ? '' : 's'}.`,
    });
  },
};

export default command;
