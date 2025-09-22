import { SlashCommandBuilder, CommandInteraction, GuildMember } from 'discord.js';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume paused music or recover from crash'),

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
            ephemeral: true,
          });
          return;
        }
      } catch (error) {
        await interaction.reply({
          content: '❌ Failed to restore music session!',
          ephemeral: true,
        });
        return;
      }
    }

    // If queue exists, check if it's paused and can be resumed
    if (queue.player && !queue.playing) {
      // Try crash recovery first
      const resumed = await musicManager.resumeFromCrash(interaction.guild.id);
      if (resumed) {
        await interaction.reply({
          content: '🔄 Recovered and resumed from crash!',
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
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: '❌ No paused music to resume. Use `/play` to start playing music.',
        ephemeral: true,
      });
    }
  },
};

export default command;
