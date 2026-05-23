import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '@/types';
import { backgroundDownloader } from '@/utils/backgroundDownloader';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('download-stats')
    .setDescription('Show background download statistics and queue status'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const stats = backgroundDownloader.getStats();

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 Background Download Statistics')
      .addFields(
        {
          name: '📋 Download Queue',
          value: `${stats.queueSize} songs waiting`,
          inline: true,
        },
        {
          name: '⬇️ Active Downloads',
          value: `${stats.activeDownloads} songs downloading`,
          inline: true,
        },
        {
          name: '🏠 Server Downloads',
          value: stats.guildDownloads.get(interaction.guild.id)?.toString() || '0',
          inline: true,
        },
      )
      .setTimestamp();

    // Add per-server breakdown if there are active downloads
    if (stats.guildDownloads.size > 0) {
      const serverBreakdown = Array.from(stats.guildDownloads.entries())
        .map(([guildId, count]) => `Server ${guildId.slice(-4)}: ${count} downloads`)
        .join('\n');

      embed.addFields({
        name: '🌐 All Servers',
        value: serverBreakdown || 'None',
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
