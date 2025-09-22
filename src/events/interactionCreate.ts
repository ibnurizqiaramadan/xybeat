import { Events, Interaction, MessageFlags } from 'discord.js';
import { BotEvent, ExtendedClient } from '@/types';
import { Logger } from '@/utils/logger';

const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(...args: unknown[]) {
    const [interaction] = args as [Interaction];
    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as ExtendedClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      Logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
      Logger.info(`Executed command: ${interaction.commandName} by ${interaction.user.tag}`);
    } catch (error) {
      Logger.error(`Error executing command ${interaction.commandName}:`, error as Error);

      try {
        if (interaction.replied) {
          await interaction.followUp({
            content: 'There was an error while executing this command!',
            flags: MessageFlags.Ephemeral,
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: 'There was an error while executing this command!',
          });
        } else {
          await interaction.reply({
            content: 'There was an error while executing this command!',
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (responseError) {
        Logger.error('Failed to send error response:', responseError as Error);
      }
    }
  },
};

export default event;
