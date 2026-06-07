import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command, ExtendedClient } from '@/types';
import { formatUptime } from '@/utils/timeFormat';

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

    // Group commands into a single description string
    const commandList = client.commands
      .map((cmd) => `**\`/${cmd.data.name}\`** - ${cmd.data.description || 'No description available'}`)
      .join('\n');

    embed.setDescription(`Here are all the commands you can use:\n\n${commandList}`);

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
        value: `• **Ping:** ${client.ws.ping}ms\n• **Uptime:** ${formatUptime(client.uptime!)}`,
        inline: true,
      },
    );

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
