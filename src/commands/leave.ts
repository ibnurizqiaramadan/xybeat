import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave voice channel and clear all music data'),

  async execute(interaction) {
    // Check if user is in a voice channel
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member?.voice.channel) {
      await interaction.reply({
        content: '❌ You need to be in a voice channel to use this command!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if bot is in a voice channel
    const botVoiceChannel = interaction.guild?.members.me?.voice.channel;
    if (!botVoiceChannel) {
      await interaction.reply({
        content: '❌ I\'m not connected to any voice channel!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if user is in the same voice channel as bot
    if (member.voice.channel.id !== botVoiceChannel.id) {
      await interaction.reply({
        content: '❌ You need to be in the same voice channel as me!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // Get current queue info for response message
      const queue = musicManager.getQueue(interaction.guild!.id);
      const wasPlaying = queue?.playing || false;
      const songsCount = queue?.songs.length || 0;

      // Leave voice and clear all data
      await musicManager.leaveVoice(interaction.guild!.id);

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

      await interaction.reply({
        content: responseContent,
      });
    } catch (error) {
      console.error('Error leaving voice channel:', error);

      await interaction.reply({
        content: '❌ Failed to leave voice channel. Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
