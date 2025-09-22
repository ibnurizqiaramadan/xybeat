import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '@/types';
import { config } from '@/config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get the invite link to add this bot to your server'),

  async execute(interaction: CommandInteraction) {
    // Permission value for required bot permissions
    // Use Slash Commands + Send Messages + View Channels + Read Message History + Embed Links
    const permissionValue = '2147555328';

    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${
      config.clientId
    }&permissions=${permissionValue}&scope=bot%20applications.commands`;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2) // Discord blurple color
      .setTitle('🎵 Invite XyBeat to Your Server!')
      .setDescription('Add XyBeat to your server for high-quality music streaming! Click the link below to get started.')
      .addFields(
        {
          name: '📋 Invite Link',
          value: `[Click here to invite me!](${inviteUrl})`,
          inline: false,
        },
        {
          name: '🔒 Required Permissions',
          value: [
            '• Use Slash Commands',
            '• Send Messages',
            '• View Channels',
            '• Read Message History',
            '• Embed Links',
          ].join('\n'),
          inline: true,
        },
        {
          name: '⚡ Features',
          value: [
            '• `/ping` - Check latency',
            '• `/help` - Show commands',
            '• `/server` - Server info',
            '• `/invite` - Get invite link',
          ].join('\n'),
          inline: true,
        },
      )
      .setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
