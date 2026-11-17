import { SlashCommandBuilder, CommandInteraction, MessageFlags } from 'discord.js';
import { Command } from '@/types';
import { MinimalTextChannel } from '@/types/music';
import { musicManager } from '@/utils/musicManager';
import { validateVoiceConnection } from '@/utils/commandHelper';
import { redisManager } from '@/utils/redis';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stay')
    .setDescription('Toggle 24/7 mode (stay in voice even when the channel is empty)'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) return;

    const voiceChannel = await validateVoiceConnection(interaction, true);
    if (!voiceChannel) return;

    // No queue or auto-disconnected: join the user's channel so there is something to keep.
    let queue = musicManager.getQueue(interaction.guild.id);
    if (!queue?.connection) {
      if (!interaction.channel) {
        await interaction.reply({ content: '❌ Could not access the text channel!', flags: MessageFlags.Ephemeral });
        return;
      }
      queue = await musicManager.createQueue(
        interaction.guild.id,
        voiceChannel,
        interaction.channel as unknown as MinimalTextChannel,
      );
    }

    queue.stay = !queue.stay;
    const textChannelId = (queue.textChannel as unknown as { id?: string }).id ?? interaction.channelId;
    await redisManager.setStay(
      interaction.guild.id,
      queue.stay ? { voiceChannelId: queue.voiceChannel.id, textChannelId } : null,
    );

    await interaction.reply({
      content: queue.stay ?
        '📌 24/7 mode **enabled** - I\'ll stay in voice even when everyone leaves.' :
        '📌 24/7 mode **disabled** - I\'ll auto-pause and leave when the channel is empty.',
    });
  },
};

export default command;
