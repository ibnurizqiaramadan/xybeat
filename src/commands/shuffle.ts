import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/types';
import { validateVoiceConnection } from '@/utils/commandHelper';
import { musicManager } from '@/utils/musicManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the music queue randomly'),

  async execute(interaction) {
    if (!interaction.guild) return;

    const voiceChannel = await validateVoiceConnection(interaction, true);
    if (!voiceChannel) return;

    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue) {
      const { MessageFlags: LocalFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ No music queue found! Use `/play` to start playing music first.',
        flags: LocalFlags.Ephemeral,
      });
      return;
    }

    if (queue.songs.length <= 1) {
      const { MessageFlags: LocalFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ Need at least 2 songs in queue to shuffle!',
        flags: LocalFlags.Ephemeral,
      });
      return;
    }

    try {
      await interaction.deferReply();
      const shuffledCount = await musicManager.shuffleQueue(interaction.guild.id);

      if (shuffledCount === 0) {
        await interaction.editReply({
          content: '❌ Nothing to shuffle! Need at least 2 songs in queue.',
        });
        return;
      }

      const currentSong = queue.songs[0];
      const responseContent = (queue.playing && currentSong) ?
        `🔀 **Shuffled ${shuffledCount} songs!**\n\n` +
          `🎵 **Currently Playing:** ${currentSong.title}\n` +
          `📋 **Queue:** ${queue.songs.length - 1} songs shuffled and ready` :
        `🔀 **Shuffled ${shuffledCount} songs!**\n\n` +
          `📋 **Queue:** All ${queue.songs.length} songs have been shuffled`;

      await interaction.editReply({ content: responseContent });
    } catch (error) {
      console.error('Error shuffling queue:', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Failed to shuffle the queue. Please try again later.' });
      } else {
        const { MessageFlags: LocalFlags } = await import('discord.js');
        await interaction.reply({
          content: '❌ Failed to shuffle the queue. Please try again later.',
          flags: LocalFlags.Ephemeral,
        });
      }
    }
  },
};

export default command;
