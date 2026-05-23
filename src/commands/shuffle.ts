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

    // Check if there's a music queue
    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue) {
      const { MessageFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ No music queue found! Use `/play` to start playing music first.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if queue has enough songs to shuffle
    if (queue.songs.length <= 1) {
      const { MessageFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ Need at least 2 songs in queue to shuffle!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // Defer reply for potential processing time
      await interaction.deferReply();

      // Shuffle the queue
      const shuffledCount = await musicManager.shuffleQueue(interaction.guild.id);

      if (shuffledCount === 0) {
        await interaction.editReply({
          content: '❌ Nothing to shuffle! Need at least 2 songs in queue.',
        });
        return;
      }

      // Create response message
      const currentSong = queue.songs[0];
      const responseContent = queue.playing && currentSong ?
        `🔀 **Shuffled ${shuffledCount} songs!**\n\n` +
          `🎵 **Currently Playing:** ${currentSong.title}\n` +
          `📋 **Queue:** ${queue.songs.length - 1} songs shuffled and ready` :
        `🔀 **Shuffled ${shuffledCount} songs!**\n\n` +
          `📋 **Queue:** All ${queue.songs.length} songs have been shuffled`;

      await interaction.editReply({
        content: responseContent,
      });
    } catch (error) {
      console.error('Error shuffling queue:', error);

      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ Failed to shuffle the queue. Please try again later.',
        });
      } else {
        const { MessageFlags } = await import('discord.js');
        await interaction.reply({
          content: '❌ Failed to shuffle the queue. Please try again later.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};

export default command;
