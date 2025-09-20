import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Command, ExtendedClient } from '@/types';

const command: Command = {
  data: new SlashCommandBuilder().setName('help').setDescription('Shows all available commands'),

  async execute(interaction: CommandInteraction) {
    const client = interaction.client as ExtendedClient;

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📚 Help - Available Commands')
      .setDescription('Here are all the commands you can use:')
      .setTimestamp()
      .setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    // Add fields for each command
    client.commands.forEach((cmd) => {
      embed.addFields({
        name: `\`/${cmd.data.name}\``,
        value: cmd.data.description || 'No description available',
        inline: false,
      });
    });

    // Add bot information
    embed.addFields(
      {
        name: '\u200B',
        value: '\u200B',
        inline: false,
      },
      {
        name: '🤖 Bot Information',
        value: `• **Guilds:** ${client.guilds.cache.size}\n• **Users:** ${
          client.users.cache.size
        }\n• **Commands:** ${client.commands.size}`,
        inline: true,
      },
      {
        name: '⚡ Performance',
        value: `• **Ping:** ${client.ws.ping}ms\n• **Uptime:** ${Math.floor(
          client.uptime! / 1000,
        )}s`,
        inline: true,
      },
    );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};

export default command;
