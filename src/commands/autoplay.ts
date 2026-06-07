import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';
import { validateVoiceConnection } from '@/utils/commandHelper';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay mode (plays related songs when queue ends)'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) return;

    const voiceChannel = await validateVoiceConnection(interaction, true);
    if (!voiceChannel) return;

    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue) {
      const { MessageFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ Start playing some music first!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    queue.autoplay = !queue.autoplay;

    await interaction.reply({
      content: `🔄 Autoplay is now **${queue.autoplay ? 'enabled' : 'disabled'}**!`,
    });
  },
};

export default command;
