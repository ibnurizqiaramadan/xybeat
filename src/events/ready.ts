import { Events, ActivityType } from 'discord.js';
import { BotEvent, ExtendedClient } from '@/types';
import { Logger } from '@/utils/logger';

const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  async execute(...args: unknown[]) {
    const [client] = args as [ExtendedClient];
    Logger.info(`Ready! Logged in as ${client.user?.tag}`);
    Logger.info(`Bot is in ${client.guilds.cache.size} servers`);

    // Set bot activity with server count and music focus
    client.user?.setPresence({
      activities: [{
        name: `🎵 Music in ${client.guilds.cache.size} servers`,
        type: ActivityType.Playing,
        state: 'Use /help for commands!',
      }],
      status: 'online',
    });

    Logger.info(`Bot presence set for ${client.guilds.cache.size} servers`);
  },
};

export default event;
