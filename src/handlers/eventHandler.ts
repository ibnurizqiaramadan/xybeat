import { readdirSync } from 'fs';
import { join } from 'path';
import { ExtendedClient, BotEvent } from '@/types';
import { Logger } from '@/utils/logger';

/**
 * Load all events from the events directory.
 * @param {ExtendedClient} client - The Discord client instance.
 */
export async function loadEvents(client: ExtendedClient): Promise<void> {
  const eventsPath = join(__dirname, '../events');

  try {
    const eventFiles = readdirSync(eventsPath).filter(
      (file) => file.endsWith('.ts') || file.endsWith('.js'),
    );

    for (const file of eventFiles) {
      const filePath = join(eventsPath, file);
      const { default: event }: { default: BotEvent } = await import(filePath);

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }

      Logger.info(`Loaded event: ${event.name}`);
    }

    Logger.info(`Successfully loaded ${eventFiles.length} events`);
  } catch (error) {
    Logger.error('Error loading events:', error as Error);
  }
}
