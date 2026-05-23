import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';
import { validateVoiceConnection } from '@/utils/commandHelper';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave voice channel and clear all music data'),

  async execute(interaction) {
    if (!interaction.guild) return;

    // Check if user is in a voice channel (and same channel as bot if bot is connected)
    const voiceChannel = await validateVoiceConnection(interaction, true);
    if (!voiceChannel) return;

    // Check if bot is in a voice channel (specifically for leave command)
    const botVoiceChannel = interaction.guild.members.me?.voice.channel;
    if (!botVoiceChannel) {
      const { MessageFlags: LocalFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ I\'m not connected to any voice channel!',
        flags: LocalFlags.Ephemeral,
      });
      return;
    }

    try {
      // Get current queue info for response message
      const queue = musicManager.getQueue(interaction.guild.id);
      const wasPlaying = queue?.playing || false;
      const songsCount = queue?.songs.length || 0;

      // Leave voice and clear all data
      await musicManager.leaveVoice(interaction.guild.id);

      // Create response message based on what was cleared
      let responseContent = '👋 **Left voice channel**\n\n';

      if (wasPlaying && songsCount > 0) {
        responseContent += '✅ Stopped currently playing music\n';
        responseContent += `🗑️ Cleared queue with ${songsCount} song${songsCount !== 1 ? 's' : ''}\n`;
        responseContent += '💾 Removed all saved data';
      } else if (songsCount > 0) {
        responseContent += `🗑️ Cleared queue with ${songsCount} song${songsCount !== 1 ? 's' : ''}\n`;
        responseContent += '💾 Removed all saved data';
      } else {
        responseContent += '✅ Disconnected from voice channel';
      }

      await interaction.reply({ content: responseContent });
    } catch (error) {
      console.error('Error leaving voice channel:', error);

      const { MessageFlags: LocalFlags } = await import('discord.js');
      await interaction.reply({
        content: '❌ Failed to leave voice channel. Please try again later.',
        flags: LocalFlags.Ephemeral,
      });
      return;
    }
  },
};

export default command;
