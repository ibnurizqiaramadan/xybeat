import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '@/types';
import { config } from '@/config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get the invite link to add this bot to your server'),

  async execute(interaction: CommandInteraction) {
    // Permission value for required bot permissions
    // View Channels + Send Messages + Embed Links + Read Message History + Connect + Speak + Use VAD + Use Application Commands + Add Reactions + Attach Files
    const permissionValue = '2184301632';

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
            '• View Channels',
            '• Send Messages',
            '• Embed Links',
            '• Read Message History',
            '• Connect (Voice)',
            '• Speak (Voice)',
            '• Use Voice Activity',
            '• Use Application Commands',
            '• Add Reactions',
            '• Attach Files',
          ].join('\n'),
          inline: true,
        },
        {
          name: '⚡ Features',
          value: [
            '• `/play` - Play YouTube music',
            '• `/queue` - View music queue',
            '• `/pause` - Pause playback',
            '• `/resume` - Resume music',
            '• `/skip` - Skip current song',
            '• `/shuffle` - Randomize queue',
            '• `/help` - Show all commands',
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
