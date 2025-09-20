# Xyrus10 Discord Bot

A Discord bot built with TypeScript and discord.js v14, featuring slash commands and a modular architecture.

## Features

- 🚀 Built with TypeScript for type safety
- ⚡ Discord.js v14 with latest features
- 🎯 Slash commands support
- 📁 Modular command and event structure
- 🔧 Hot reload in development
- 🎨 Beautiful embedded responses
- 📊 Built-in bot statistics
- 🛡️ Error handling and logging

## Setup

### Prerequisites

- Node.js 16.11.0 or higher
- A Discord application and bot token

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone <repository-url>
   cd xyrus10-bot
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Copy the environment file and configure it:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. Edit \`.env\` with your bot configuration:
   \`\`\`env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_id_here
   GUILD_ID=your_guild_id_here_for_development
   NODE_ENV=development
   \`\`\`

### Getting Discord Bot Credentials

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the bot token and set it as \`DISCORD_TOKEN\`
5. Go to the "General Information" section and copy the Application ID as \`CLIENT_ID\`
6. For development, copy your server ID as \`GUILD_ID\` (right-click server in Discord with Developer Mode enabled)

### Running the Bot

1. Deploy commands (required after adding new commands):
   \`\`\`bash
   npm run deploy-commands
   \`\`\`

2. Start the bot in development mode:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Or build and run in production:
   \`\`\`bash
   npm run build
   npm start
   \`\`\`

## Available Commands

- \`/ping\` - Check bot latency and responsiveness
- \`/help\` - Show all available commands and bot information
- \`/server\` - Get information about the current server

## Development

### Scripts

- \`npm run dev\` - Start bot in development mode with hot reload
- \`npm run build\` - Build TypeScript to JavaScript
- \`npm start\` - Start the built bot
- \`npm run deploy-commands\` - Deploy slash commands to Discord
- \`npm run lint\` - Run ESLint and fix issues
- \`npm run format\` - Format code with Prettier

### Project Structure

\`\`\`
src/
├── commands/ # Slash commands
├── events/ # Discord event handlers
├── handlers/ # Command and event loaders
├── types/ # TypeScript type definitions
├── utils/ # Utility functions and classes
├── config/ # Configuration management
└── index.ts # Main bot entry point
\`\`\`

### Adding New Commands

1. Create a new file in \`src/commands/\` following the existing pattern
2. Export a command object with \`data\` and \`execute\` properties
3. Run \`npm run deploy-commands\` to register the new command
4. Restart the bot

### Adding New Events

1. Create a new file in \`src/events/\` following the existing pattern
2. Export an event object with \`name\`, \`execute\`, and optionally \`once\` properties
3. Restart the bot to load the new event

## Bot Permissions

The bot requires the following permissions:

- Send Messages
- Use Slash Commands
- Read Message History
- View Channels

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and formatting: \`npm run lint && npm run format\`
5. Test your changes
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
