import 'dotenv/config';

interface Config {
  token: string;
  clientId: string;
  guildId: string | undefined;
}

export const config: Config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID,
};

// Validate required environment variables
if (!config.token) {
  throw new Error('DISCORD_TOKEN is required in environment variables');
}

if (!config.clientId) {
  throw new Error('CLIENT_ID is required in environment variables');
}
