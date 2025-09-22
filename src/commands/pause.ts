import { SlashCommandBuilder, CommandInteraction, GuildMember } from 'discord.js';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';

const command: Command = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the current song'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ You need to be in a voice channel to use music commands!',
        ephemeral: true,
      });
      return;
    }

    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue || !queue.playing) {
      await interaction.reply({
        content: '❌ There is no music currently playing!',
        ephemeral: true,
      });
      return;
    }

    musicManager.pause(interaction.guild.id);

    await interaction.reply({
      content: '⏸️ Paused the current song.',
    });
  },
};

export default command;
