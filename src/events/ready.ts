import { Events } from 'discord.js';
import { BotEvent, ExtendedClient } from '../types';
import { Logger } from '../utils/logger';

const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  async execute(client: ExtendedClient) {
    Logger.info(`Ready! Logged in as ${client.user?.tag}`);
    Logger.info(`Bot is in ${client.guilds.cache.size} servers`);

    // Set bot activity
    client.user?.setActivity('with TypeScript!', { type: 0 });
  },
};

export default event;
