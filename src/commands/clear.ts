import { SlashCommandBuilder, CommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear the entire music queue'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ You need to be in a voice channel to use music commands!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue) {
      await interaction.reply({
        content: '❌ There is no music queue to clear!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (queue.songs.length === 0) {
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
