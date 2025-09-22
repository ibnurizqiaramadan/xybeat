# Xyrus10 Discord Bot

A Discord bot built with TypeScript and discord.js v14, featuring slash commands and a modular architecture.

## Features

### Core Features

- 🚀 Built with TypeScript for type safety
- ⚡ Discord.js v14 with latest features
- 🎯 Slash commands support
- 📁 Modular command and event structure
- 🔧 Hot reload in development
- 🎨 Beautiful embedded responses
- 📊 Built-in bot statistics
- 🛡️ Error handling and logging

### 🎵 Advanced Music System

- 🎶 **Native yt-dlp Integration** - Direct binary usage for maximum reliability
- 📋 **YouTube Playlist Support** - Add entire playlists with one command
- 💾 **Local MP3 Caching** - Downloaded files are cached for faster replay
- ⏯️ **Complete Music Controls** (play, pause, resume, skip, stop)
- 📄 **Paginated Queue Display** - Interactive navigation for large queues
- 🎛️ **Voice Channel Integration** - Auto-join/leave with smart connection handling
- 🔍 **YouTube Search** - Search for videos by keywords
- 🎯 **Format Selection** - Uses optimal audio formats (format 18 + MP3 conversion)
- 🔄 **Automatic Fallback** - Graceful handling of private/unavailable playlists

## Setup

### Prerequisites

- Node.js 16.11.0 or higher
- A Discord application and bot token
- **yt-dlp** binary installed (`/snap/bin/yt-dlp`)
- **FFmpeg** binary installed (`/usr/bin/ffmpeg`)

### System Dependencies

For Ubuntu/Debian:

```bash
# Install yt-dlp
sudo snap install yt-dlp

# Install FFmpeg
sudo apt update && sudo apt install ffmpeg

# Verify installations
yt-dlp --version
ffmpeg -version
```

For other systems, please install yt-dlp and FFmpeg according to your OS package manager.

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

### General Commands

- \`/ping\` - Check bot latency and responsiveness
- \`/help\` - Show all available commands and bot information
- \`/server\` - Get information about the current server
- \`/invite\` - Get the invite link to add bot to servers

### 🎵 Music Commands

| Command     | Description                                            | Examples                                                                                                                                          |
| ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| \`/play\`   | Play music from YouTube (videos, playlists, or search) | \`/play query: https://youtube.com/watch?v=...\`<br>\`/play query: https://youtube.com/playlist?list=...\`<br>\`/play query: your favorite song\` |
| \`/queue\`  | Show current music queue with pagination               | Interactive navigation with buttons                                                                                                               |
| \`/pause\`  | Pause the current song                                 | Pauses playback                                                                                                                                   |
| \`/resume\` | Resume the paused song                                 | Resumes playback                                                                                                                                  |
| \`/skip\`   | Skip to the next song in queue                         | Moves to next track                                                                                                                               |
| \`/stop\`   | Stop music and clear entire queue                      | Stops and clears all songs                                                                                                                        |

#### 🎶 Music Features Details

**Supported Input Types:**

- ✅ **Direct YouTube URLs** - Single video links
- ✅ **YouTube Playlists** - Entire playlists (up to 50 videos)
- ✅ **Search Queries** - Search by song name/artist
- ✅ **Mixed URLs** - Videos with playlist parameters

**Queue Management:**

- 📄 **Paginated Display** - Shows 10 songs per page with navigation buttons
- 🔄 **Real-time Updates** - Queue updates automatically as songs are added/removed
- 👤 **User Permissions** - Only command user can navigate pages
- ⏰ **Auto-timeout** - Navigation buttons disable after 5 minutes

**Audio Processing:**

- 🎯 **Format 18** - Optimal quality/compatibility balance
- 🔄 **MP3 Conversion** - All audio converted to MP3 for consistency
- 💾 **Local Storage** - Files cached in \`~/music-bot/mp3/\` directory
- 🚀 **Fast Replay** - Cached files play instantly on repeat

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
- Connect (for voice channels)
- Speak (for voice channels)

## Troubleshooting

### Music Player Issues

If you encounter issues with the music player:

#### Common Solutions

1. **Check system dependencies**:
   \`\`\`bash

   # Verify yt-dlp is installed and accessible

   /snap/bin/yt-dlp --version

   # Verify FFmpeg is installed

   /usr/bin/ffmpeg -version
   \`\`\`

2. **Check voice permissions**: Ensure bot has Connect and Speak permissions in voice channels

3. **Verify file permissions**: Ensure bot can write to \`~/music-bot/mp3/\` directory
   \`\`\`bash
   mkdir -p ~/music-bot/mp3
   chmod 755 ~/music-bot/mp3
   \`\`\`

4. **Check bot logs**: Look for specific error messages in console output

#### Playlist Issues

- **Private playlists**: Bot will extract single video if playlist is private
- **Large playlists**: Limited to 50 videos to prevent spam
- **Mixed URLs**: Bot automatically handles video URLs with playlist parameters

#### Audio Quality Issues

- **Format 18**: Used for optimal quality/compatibility balance
- **MP3 conversion**: All audio standardized to MP3 format
- **Local caching**: Files stored locally for faster subsequent access

For detailed troubleshooting history, see \`YTDL_FIX.md\` and \`DAVE_FIX.md\`.

## 🆕 What's New

### Latest Updates

- ✅ **Native yt-dlp Integration** - Replaced play-dl with direct yt-dlp binary calls
- ✅ **YouTube Playlist Support** - Full playlist extraction and queueing
- ✅ **Paginated Queue System** - Interactive navigation with buttons
- ✅ **MP3 File Caching** - Local storage for faster replay
- ✅ **Enhanced Error Handling** - Graceful fallbacks for private/unavailable content
- ✅ **Format Optimization** - Uses format 18 with FFmpeg conversion for best compatibility
- ✅ **Discord.js v14 Compatibility** - Fixed all deprecation warnings

### Technical Architecture

The bot now uses a hybrid approach:

1. **yt-dlp** for metadata extraction and video downloading
2. **FFmpeg** for audio format conversion (format 18 → MP3)
3. **Local file system** for caching downloaded audio
4. **Discord.js voice** for audio playback from cached files

This provides maximum reliability, faster subsequent playback, and better format compatibility.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and formatting: \`npm run lint && npm run format\`
5. Test your changes
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
