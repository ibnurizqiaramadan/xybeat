import { SlashCommandBuilder, CommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playing music (queue will be preserved)'),

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
