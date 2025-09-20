import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Provides information about the server'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📊 ${guild.name} Server Information`)
      .setThumbnail(guild.iconURL())
      .addFields(
        {
          name: '🆔 Server ID',
          value: guild.id,
          inline: true,
        },
        {
          name: '👑 Owner',
          value: `<@${guild.ownerId}>`,
          inline: true,
        },
        {
          name: '📅 Created',
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
          inline: true,
        },
        {
          name: '👥 Members',
          value: guild.memberCount.toString(),
          inline: true,
        },
        {
          name: '🎭 Roles',
          value: guild.roles.cache.size.toString(),
          inline: true,
        },
        {
          name: '💬 Channels',
          value: guild.channels.cache.size.toString(),
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};

export default command;
