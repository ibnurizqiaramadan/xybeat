import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { validateVoiceConnection } from '@/utils/commandHelper';
import { musicManager } from '@/utils/musicManager';

const command: Command = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) return;

    const voiceChannel = await validateVoiceConnection(interaction, true);
    if (!voiceChannel) return;

    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue || !queue.playing) {
      const { MessageFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ There is no music currently playing!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    musicManager.skip(interaction.guild.id);

    await interaction.reply({
      content: '⏭️ Skipped the current song.',
    });
  },
};

export default command;
