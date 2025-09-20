import { Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command, ExtendedClient } from '@/types';
import { Logger } from '@/utils/logger';

/**
 * Load all commands from the commands directory.
 * @param {ExtendedClient} client - The Discord client instance.
 */
export async function loadCommands(client: ExtendedClient): Promise<void> {
  client.commands = new Collection();

  const commandsPath = join(__dirname, '../commands');

  try {
    const commandFiles = readdirSync(commandsPath).filter(
      (file) => file.endsWith('.ts') || file.endsWith('.js'),
    );

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const { default: command }: { default: Command } = await import(filePath);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        Logger.info(`Loaded command: ${command.data.name}`);
      } else {
        Logger.warn(
          `The command at ${filePath} is missing a required "data" or "execute" property.`,
        );
      }
    }

    Logger.info(`Successfully loaded ${client.commands.size} commands`);
  } catch (error) {
    Logger.error('Error loading commands:', error as Error);
  }
}
