import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { config } from '@/config';
import { Command } from '@/types';
import { Logger } from '@/utils/logger';

/**
 * Deploy slash commands to Discord API.
 */
async function deployCommands(): Promise<void> {
  const commands = [];
  const commandsPath = join(__dirname, 'commands');

  try {
    const commandFiles = readdirSync(commandsPath).filter(
      (file) => file.endsWith('.ts') || file.endsWith('.js'),
    );

    // Load all commands
    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const { default: command }: { default: Command } = await import(filePath);

      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        Logger.info(`Loaded command for deployment: ${command.data.name}`);
      } else {
        Logger.warn(
          `The command at ${filePath} is missing a required "data" or "execute" property.`,
        );
      }
    }

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(config.token);

    Logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    // Deploy commands globally or to a specific guild
    let data;
    if (config.guildId) {
      // Deploy to specific guild (faster for development)
      data = (await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
        body: commands,
      })) as unknown[];
      Logger.info(`Successfully reloaded ${data.length} guild application (/) commands.`);
    } else {
      // Deploy globally (takes up to 1 hour to update)
      data = (await rest.put(Routes.applicationCommands(config.clientId), {
        body: commands,
      })) as unknown[];
      Logger.info(`Successfully reloaded ${data.length} global application (/) commands.`);
    }
  } catch (error) {
    Logger.error('Error deploying commands:', error as Error);
    process.exit(1);
  }
}

// Run the deployment
deployCommands();
