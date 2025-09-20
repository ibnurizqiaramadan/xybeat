import { Events, Interaction } from 'discord.js';
import { BotEvent, ExtendedClient } from '../types';
import { Logger } from '../utils/logger';

const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
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

      const errorMessage = {
        content: 'There was an error while executing this command!',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default event;
