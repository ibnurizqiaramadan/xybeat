import { SlashCommandBuilder, CommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';
import { Logger } from '@/utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume paused music or recover from crash'),

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

    let queue = musicManager.getQueue(interaction.guild.id);

    // If no queue exists, try to create one and restore from Redis
    if (!queue) {
      try {
        queue = await musicManager.createQueue(
          interaction.guild.id,
          voiceChannel,
          interaction.channel as unknown as import('@/types/music').MinimalTextChannel,
        );

        // Try crash recovery first
        const resumed = await musicManager.resumeFromCrash(interaction.guild.id);
        if (resumed) {
          await interaction.reply({
            content: '🔄 Recovered and resumed from previous session!',
          });
          return;
        }

        // If no crash recovery possible, check if there's a queue to resume
        if (queue.songs.length > 0) {
          await interaction.reply({
            content: `📋 Restored queue with ${queue.songs.length} song(s). Use \`/play\` to start playing.`,
          });
          return;
        } else {
          await interaction.reply({
            content: '❌ No music queue or crashed session found to resume!',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      } catch (error) {
        await interaction.reply({
          content: '❌ Failed to restore music session!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // If queue exists, check if it's paused and can be resumed
    if (queue.player && !queue.playing) {
      // Check if bot is connected to voice channel
      if (!queue.connection) {
        // Bot was disconnected, need to reconnect first
        try {
          const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
          });

          queue.connection = connection;
          connection.subscribe(queue.player);

          Logger.info(`Reconnected to voice channel ${voiceChannel.name} for resume in guild ${interaction.guild.id}`);
        } catch (error) {
          await interaction.reply({
            content: '❌ Failed to reconnect to voice channel!',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      // Try crash recovery first (now that we have voice connection)
      const resumed = await musicManager.resumeFromCrash(interaction.guild.id);
      if (resumed) {
        await interaction.reply({
          content: '🔄 Recovered and resumed from previous session!',
        });
        return;
      }

      // Normal resume for paused music
      musicManager.resume(interaction.guild.id);
      await interaction.reply({
        content: '▶️ Resumed the current song.',
      });
    } else if (queue.playing) {
      await interaction.reply({
        content: '❌ Music is already playing!',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: '❌ No paused music to resume. Use `/play` to start playing music.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
