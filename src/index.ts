import { Client, GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from '@/types';
import { config } from '@/config';
import { loadCommands } from '@/handlers/commandHandler';
import { loadEvents } from '@/handlers/eventHandler';
import { Logger } from '@/utils/logger';
import { deployCommands } from '@/deploy-commands';
import { redisManager } from '@/utils/redis';

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
}) as ExtendedClient;

/**
 * Main function to initialize and start the Discord bot.
 */
async function main(): Promise<void> {
  try {
    Logger.info('Starting bot...');

    // Initialize Redis connection
    await redisManager.initialize();

    // Deploy commands automatically
    await deployCommands(true);

    // Load commands and events
    await loadCommands(client);
    await loadEvents(client);

    // Login to Discord
    await client.login(config.token);
  } catch (error) {
    Logger.error('Failed to start bot:', error as Error);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', async() => {
  Logger.info('Received SIGINT, shutting down gracefully...');
  await redisManager.disconnect();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async() => {
  Logger.info('Received SIGTERM, shutting down gracefully...');
  await redisManager.disconnect();
  client.destroy();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  Logger.error('Unhandled promise rejection:', error as Error);
});

// Start the bot
main();
