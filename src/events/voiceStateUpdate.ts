import { Events, VoiceState } from 'discord.js';
import { BotEvent } from '@/types';
import { musicManager } from '@/utils/musicManager';
import { Logger } from '@/utils/logger';

const event: BotEvent = {
  name: Events.VoiceStateUpdate,
  async execute(...args: unknown[]) {
    const [oldState, newState] = args as [VoiceState, VoiceState];

    // Only handle if this affects a channel where the bot is connected
    const botVoiceChannel = oldState.guild.members.me?.voice.channel ||
                           newState.guild.members.me?.voice.channel;

    if (!botVoiceChannel) {
      return; // Bot is not in any voice channel
    }

    // Check if the voice state change is related to the bot's voice channel
    const affectedChannel = oldState.channel || newState.channel;
    if (affectedChannel?.id !== botVoiceChannel.id) {
      return; // Not the same channel as bot
    }

    // Get the current queue for this guild
    const queue = musicManager.getQueue(oldState.guild.id);
    if (!queue) {
      return; // No music queue active
    }

    // Count non-bot members in the voice channel
    const nonBotMembers = botVoiceChannel.members.filter((member) => !member.user.bot);

    Logger.debug(`Voice state update in ${botVoiceChannel.name}: ${nonBotMembers.size} non-bot members`);

    if (nonBotMembers.size === 0) {
      // No users left in voice channel
      Logger.info(`No users left in voice channel ${botVoiceChannel.name}, auto-pausing and scheduling disconnect`);

      // Pause the music if it's playing
      if (queue.playing) {
        musicManager.pause(oldState.guild.id);

        // Send notification to text channel
        try {
          await queue.textChannel.send({
            content: '⏸️ **Auto-paused** - No users in voice channel. Music will resume when someone joins.',
          });
        } catch (error) {
          Logger.warn('Failed to send auto-pause notification:', error as Error);
        }
      }

      // Set a timeout to disconnect if no one joins back within 5 minutes
      setTimeout(async() => {
        // Check if voice channel is still empty using musicManager method
        if (musicManager.isVoiceChannelEmpty(oldState.guild.id)) {
          Logger.info(`Voice channel still empty after timeout, disconnecting bot from guild ${oldState.guild.id}`);

          // Get current queue (might have changed)
          const currentQueue = musicManager.getQueue(oldState.guild.id);
          if (currentQueue) {
            try {
              await currentQueue.textChannel.send({
                content: '👋 **Auto-disconnect** - Left voice channel due to inactivity. Use `/play` or `/resume` to rejoin.',
              });
            } catch (error) {
              Logger.warn('Failed to send auto-disconnect notification:', error as Error);
            }
          }

          // Disconnect from voice channel but preserve the queue
          await musicManager.disconnectVoice(oldState.guild.id);
        } else {
          Logger.debug(`Users rejoined voice channel in guild ${oldState.guild.id}, keeping connection`);
        }
      }, 5 * 60 * 1000); // 5 minutes timeout
    } else if (nonBotMembers.size > 0 && queue && !queue.playing && queue.songs.length > 0) {
      // Users joined back and there's a paused queue
      Logger.info(`Users joined voice channel ${botVoiceChannel.name}, checking if music should resume`);

      // Don't auto-resume, just notify that they can resume
      try {
        await queue.textChannel.send({
          content: '👋 **Welcome back!** Use `/resume` to continue music or `/play` to start something new.',
        });
      } catch (error) {
        Logger.warn('Failed to send rejoin notification:', error as Error);
      }
    }
  },
};

export default event;
