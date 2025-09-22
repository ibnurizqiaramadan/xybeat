import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '@/types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with bot latency information'),

  async execute(interaction: CommandInteraction) {
    await interaction.reply({
      content: 'Pinging...',
      ephemeral: true,
    });

    const sent = await interaction.fetchReply();

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🏓 Pong!')
      .addFields(
        {
          name: 'Roundtrip Latency',
          value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`,
          inline: true,
        },
        {
          name: 'Websocket Heartbeat',
          value: `${interaction.client.ws.ping}ms`,
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.editReply({
      content: '',
      embeds: [embed],
    });
  },
};

export default command;
