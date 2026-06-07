# XyBeat 🎵

A powerful Discord music bot built with TypeScript and discord.js v14, featuring advanced YouTube integration and real-time download progress tracking.

## 🎵 Music-First Features

### 🚀 Core Music Engine

- 🎶 **Native yt-dlp Integration** - Direct binary usage for maximum reliability and quality
- 📊 **Real-Time Progress Tracking** - Live download progress with visual indicators
- 💾 **Smart MP3 Caching** - Instant playback for previously downloaded songs
- 🔍 **Advanced YouTube Search** - Search by song name, artist, or paste any YouTube URL
- 📋 **Comprehensive Playlist Support** - Handle YouTube playlists of any size, mixes, and radio stations
- ⏯️ **Full Playback Controls** - Play, pause, resume, skip, stop, and queue management
- 📄 **Interactive Queue Management** - Paginated display with navigation buttons
- 🎛️ **Voice Channel Integration** - Smart auto-join/leave with optimal audio quality
- 🔄 **Intelligent Fallbacks** - Graceful handling of private/restricted content
- 🎯 **Format Optimization** - Uses best available audio formats with MP3 conversion

### 🛠️ Technical Excellence

- 🚀 **TypeScript-Powered** - Full type safety and modern development experience
- ⚡ **Discord.js v14** - Latest Discord API features and performance optimizations
- 🎯 **Slash Commands** - Modern Discord command interface
- 📁 **Modular Architecture** - Clean, maintainable, and extensible codebase
- 🔧 **Hot Reload Development** - Fast iteration during development
- 🎨 **Rich Embeds** - Beautiful and informative Discord message displays
- 🛡️ **Robust Error Handling** - Comprehensive logging and graceful failure recovery
- 📊 **Performance Monitoring** - Built-in statistics and health monitoring

## Setup

### Prerequisites

- Node.js 16.11.0 or higher
- A Discord application and bot token
- **yt-dlp** binary installed (`/snap/bin/yt-dlp`)
- **FFmpeg** binary installed (`/usr/bin/ffmpeg`)
- **Redis server** (optional) - For persistent queue storage across bot restarts

### System Dependencies

For Ubuntu/Debian:

```bash
# Install yt-dlp
sudo snap install yt-dlp

# Install FFmpeg
sudo apt update && sudo apt install ffmpeg

# Install Redis (optional, for persistent queues)
sudo apt install redis-server

# Verify installations
yt-dlp --version
ffmpeg -version
redis-server --version
```

For other systems, please install yt-dlp, FFmpeg, and Redis according to your OS package manager.

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd xybeat
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment file and configure it:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your bot configuration:

   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_id_here
   GUILD_ID=your_guild_id_here_for_development
   NODE_ENV=development

   # Redis Configuration (Optional)
   REDIS_ENABLED=false
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   REDIS_DB=0
   REDIS_KEY_PREFIX=xybeat:
   ```

   **Redis Queue Persistence (Optional):**

   - Set `REDIS_ENABLED=true` to enable persistent queue storage
   - Queues are saved by voice channel and persist across bot restarts
   - **Crash Recovery**: Currently playing song state is saved and resumed after crashes
   - **Auto-cleanup**: Playing states expire after 30 minutes of inactivity
   - Configure Redis connection details as needed

### Getting Discord Bot Credentials

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and give it a name (e.g., "XyBeat")
3. Go to the "Bot" section and create a bot
4. **Important**: Under "Privileged Gateway Intents":
   - ❌ **Presence Intent** - Not required for XyBeat
   - ❌ **Server Members Intent** - Not required for XyBeat
   - ❌ **Message Content Intent** - Not required for XyBeat (uses slash commands)
5. **Bot Permissions**: When generating invite links, use permission value `2184301632` which includes:
   - ✅ **View Channels** - See voice and text channels
   - ✅ **Send Messages** - Send command responses
   - ✅ **Embed Links** - Display rich embeds
   - ✅ **Read Message History** - Context understanding
   - ✅ **Connect** - Join voice channels
   - ✅ **Speak** - Play audio in voice channels
   - ✅ **Use Voice Activity** - Voice connection management
   - ✅ **Use Application Commands** - Execute slash commands
   - ✅ **Add Reactions** - For interactive buttons and reactions
   - ✅ **Attach Files** - For sending file attachments when needed
6. Copy the bot token and set it as `DISCORD_TOKEN`
7. Go to the "General Information" section and copy the Application ID as `CLIENT_ID`
8. For development, copy your server ID as `GUILD_ID` (right-click server in Discord with Developer Mode enabled)

### Running XyBeat

1. Start the music bot in development mode:

   ```bash
   npm run dev
   ```

2. Or build and run in production:
   ```bash
   npm run build
   npm start
   ```

**Note:** Commands are automatically registered when the bot starts. No manual deployment needed!

#### Manual Command Deployment (Optional)

If you need to manually deploy commands (for troubleshooting):

```bash
npm run deploy-commands
```

## 🎵 Music Commands

| Command           | Description                                                                                 | Usage Examples                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **🎵 `/play`**    | **Play music from YouTube** - Supports URLs, playlists, search queries, and YouTube mixes   | `/play query: Bohemian Rhapsody`<br>`/play query: https://youtube.com/watch?v=...`<br>`/play query: https://youtube.com/playlist?list=...` |
| **🔍 `/search`**  | **Search for a song** - Search and choose from multiple results                             | `/search query: Bohemian Rhapsody`                                                                                                         |
| **📋 `/queue`**   | **View music queue** - Interactive paginated display with navigation controls               | Shows current queue with song details and position                                                                                         |
| **♾️ `/autoplay`**| **Toggle autoplay mode** - Plays related songs automatically when queue ends                | Enables or disables continuous music playback                                                                                              |
| **⏸️ `/pause`**   | **Pause playback** - Temporarily stop the current song                                      | Pauses the currently playing track                                                                                                         |
| **▶️ `/resume`**  | **Resume playback or recover from crash** - Continue paused song or restore crashed session | Resumes paused track or recovers from bot crash                                                                                            |
| **⏭️ `/skip`**    | **Skip to next song** - Move to the next track in queue                                     | Skips current song and plays next                                                                                                          |
| **⏹️ `/stop`**    | **Stop music** - Stop playback but preserve queue for resuming                              | Stops music without clearing queue                                                                                                         |
| **🗑️ `/clear`**   | **Clear queue** - Remove all songs from the queue                                           | Clears the entire music queue                                                                                                              |
| **🔀 `/shuffle`** | **Shuffle queue** - Randomize the order of songs in queue                                   | Randomly reorders all queued songs                                                                                                         |
| **👋 `/leave`**   | **Leave voice channel** - Disconnect and clear all music data                               | Completely exits voice and removes all data                                                                                                |

#### 🎛️ **Stop vs Clear vs Leave Commands**

| Command         | Action             | Queue            | Voice Connection       | Redis Data     | Use Case                     |
| --------------- | ------------------ | ---------------- | ---------------------- | -------------- | ---------------------------- |
| **🛑 `/stop`**  | Stop playback only | ✅ **Preserved** | ✅ **Stays connected** | ✅ **Kept**    | Temporary pause, resumable   |
| **🗑️ `/clear`** | Clear queue only   | ❌ **Cleared**   | ✅ **Stays connected** | ❌ **Removed** | Fresh start, keep connection |
| **👋 `/leave`** | Full disconnect    | ❌ **Cleared**   | ❌ **Disconnected**    | ❌ **Removed** | Complete exit from voice     |

### 🛠️ Utility Commands

| Command           | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `/ping`           | Check bot latency and response time                  |
| `/help`           | Show all available commands and bot information      |
| `/server`         | Get information about the current server             |
| `/invite`         | Get the invite link to add XyBeat to other servers   |
| `/download-stats` | Show background download statistics and queue status |

## 🎯 Advanced Features

### 🎵 Music Input Support

| Input Type                 | Support           | Description                                  |
| -------------------------- | ----------------- | -------------------------------------------- |
| **🔗 Direct YouTube URLs** | ✅ Full           | Single video links with instant recognition  |
| **📋 YouTube Playlists**   | ✅ Full           | Complete playlists with all available videos |
| **📻 YouTube Mixes/Radio** | ✅ Smart Fallback | Automatically extracts the current video     |
| **🔍 Search Queries**      | ✅ Full           | Search by song name, artist, or keywords     |
| **🔀 Mixed URLs**          | ✅ Smart          | Videos with playlist parameters              |

### 📊 Queue Management

- **📄 Paginated Display** - Shows 10 songs per page with interactive navigation
- **🔄 Real-time Updates** - Queue updates automatically as songs are added/removed
- **👤 User Control** - Only command user can navigate queue pages
- **⏰ Auto-timeout** - Navigation buttons disable after 5 minutes for performance
- **📈 Smart Progress** - Real-time download progress with visual indicators

### 🎧 Audio Processing Pipeline

- **🎯 Format 18 Selection** - Optimal quality/compatibility balance
- **📊 Real-time Progress** - Live download tracking with percentage and speed
- **🔄 MP3 Conversion** - All audio standardized to MP3 format via FFmpeg
- **💾 Intelligent Caching** - Files stored in `~/music-bot/mp3/` directory
- **⚡ Instant Replay** - Cached files play immediately on repeat
- **🔄 Progress Cleanup** - Progress indicators automatically disappear when complete
- **🎛️ Smart Voice Management** - Auto-pause when alone, auto-disconnect after 5 minutes
- **🎛️ Multiple Disconnect Options** - Stop (preserve queue), Clear (remove songs), Leave (full disconnect)

### 🚀 Background Download System

- **⚡ Zero-Wait Playback** - Songs pre-download while music is playing, eliminating queue delays
- **🎯 Smart Prioritization** - Next song gets highest priority, followed by upcoming 5 songs in queue
- **⚙️ Concurrent Limits** - Maximum 2 downloads per server, 5 globally to prevent system overload
- **🔄 Automatic Retry** - Failed downloads retry with exponential backoff up to 3 times
- **💾 Cache Integration** - Automatically skips songs already downloaded, optimizes bandwidth
- **📊 Real-time Monitoring** - Track download progress and statistics with `/download-stats`
- **🧹 Smart Cleanup** - Clears download queue when music queue is cleared or bot leaves voice
- **🔀 Shuffle Support** - Reorders background downloads when queue is shuffled for optimal experience

## Development

### Scripts

- `npm run dev` - Start bot in development mode with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start the built bot
- `npm run deploy-commands` - Deploy slash commands to Discord
- `npm run lint` - Run ESLint and fix issues
- `npm run format` - Format and fix code with ESLint

### Project Structure

```
src/
├── commands/ # Slash commands
├── events/ # Discord event handlers
├── handlers/ # Command and event loaders
├── types/ # TypeScript type definitions
├── utils/ # Utility functions and classes
├── config/ # Configuration management
└── index.ts # Main bot entry point
```

### Adding New Commands

1. Create a new file in `src/commands/` following the existing pattern
2. Export a command object with `data` and `execute` properties
3. Run `npm run deploy-commands` to register the new command
4. Restart the bot

### Adding New Events

1. Create a new file in `src/events/` following the existing pattern
2. Export an event object with `name`, `execute`, and optionally `once` properties
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

### Bot Connection Issues

#### "Used disallowed intents" Error

If you get this error, check your Discord Developer Portal settings:

1. **Go to Discord Developer Portal** → Your Application → Bot
2. **Check "Privileged Gateway Intents"** section:
   - ❌ **DO NOT enable** "Presence Intent" (not needed)
   - ❌ **DO NOT enable** "Server Members Intent" (not needed)
   - ❌ **DO NOT enable** "Message Content Intent" (not needed for slash commands)
3. **XyBeat only needs basic intents** which are enabled by default
4. **If error persists**, the bot token might be invalid or expired

#### Permission Issues

Ensure your bot has these permissions in Discord servers:

- **Send Messages** - For command responses
- **Use Slash Commands** - For command execution
- **Connect** - To join voice channels
- **Speak** - To play audio in voice channels
- **View Channels** - To see voice and text channels

### Adding Invite Button to Bot Profile

To add a clickable invite button on your bot's Discord profile:

1. **Go to Discord Developer Portal** → Your Application → General Information
2. **Scroll down to "Install Link" section**
3. **Set the install link to:**
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=2184301632&scope=bot%20applications.commands
   ```
4. **Replace `YOUR_BOT_ID`** with your actual bot's client ID
5. **Save changes**

This will add an "Invite [BotName]" button on your bot's profile that users can click to invite the bot to their servers.

### Music Player Issues

If you encounter issues with the music player:

#### Common Solutions

1. **Check system dependencies**:

   ```bash
   # Verify yt-dlp is installed and accessible
   /snap/bin/yt-dlp --version

   # Verify FFmpeg is installed
   /usr/bin/ffmpeg -version
   ```

2. **Check voice permissions**: Ensure bot has Connect and Speak permissions in voice channels

3. **Verify file permissions**: Ensure bot can write to `~/music-bot/mp3/` directory

   ```bash
   mkdir -p ~/music-bot/mp3
   chmod 755 ~/music-bot/mp3
   ```

4. **Check bot logs**: Look for specific error messages in console output

#### Playlist Issues

- **Private playlists**: Bot will extract single video if playlist is private
- **Large playlists**: Processes all videos in playlist (no artificial limits)
- **Mixed URLs**: Bot automatically handles video URLs with playlist parameters

#### Audio Quality Issues

- **Format 18**: Used for optimal quality/compatibility balance
- **MP3 conversion**: All audio standardized to MP3 format
- **Local caching**: Files stored locally for faster subsequent access

## 🚀 What Makes XyBeat Special

### 🎵 Music-First Design

XyBeat was built from the ground up as a dedicated music bot, focusing on:

- **🎯 Reliability** - Native yt-dlp integration ensures consistent downloads
- **⚡ Performance** - Smart caching and progress tracking for optimal user experience
- **🔄 Flexibility** - Handles any YouTube content: videos, playlists, mixes, and searches
- **🎨 User Experience** - Beautiful progress indicators and intuitive controls
- **🛡️ Robustness** - Graceful fallbacks for private/restricted content

### 🏗️ Technical Architecture

XyBeat uses a sophisticated multi-layer approach:

1. **🎶 yt-dlp Engine** - Direct binary integration for maximum compatibility
2. **📊 Progress Pipeline** - Real-time download tracking with visual feedback
3. **🔄 FFmpeg Processing** - High-quality audio conversion (format 18 → MP3)
4. **💾 Smart Caching** - Local file system storage for instant replay
5. **🎛️ Discord Integration** - Optimized voice channel handling and embed displays
6. **🔧 Auto-Management** - Automatic command registration and resource cleanup

### ✨ Latest Features

- ✅ **🚀 Background Downloading** - Pre-downloads queued songs for instant playback, no more waiting!
- ✅ **⚡ Smart Download Queue** - Prioritizes next songs in queue with concurrent downloading (2-3 songs per server)
- ✅ **📊 Download Statistics** - Monitor background download progress with `/download-stats` command
- ✅ **🎯 Intelligent Caching** - Automatically skips already downloaded songs, optimizes storage usage
- ✅ **Real-Time Progress Tracking** - Live download progress with visual indicators
- ✅ **Auto Command Registration** - Commands automatically deployed on bot startup
- ✅ **Progress Cleanup** - Progress embeds automatically disappear when complete
- ✅ **Enhanced Playlist Support** - Smart fallbacks for YouTube mixes and radio, unlimited playlist size
- ✅ **Redis Queue Persistence** - Optional queue storage across bot restarts by voice channel
- ✅ **Crash Recovery System** - Resume currently playing song after bot crashes/restarts
- ✅ **Separated Stop/Clear Commands** - Stop preserves queue, clear removes all songs
- ✅ **Smart Auto-Pause & Leave** - Automatically pause when alone, disconnect after 5min timeout
- ✅ **Queue Shuffle** - Randomize song order with Fisher-Yates algorithm, preserves currently playing
- ✅ **Complete Leave Command** - Full disconnect with queue clearing and data cleanup
- ✅ **Smart Voice Reconnection** - Automatic reconnection when resuming after auto-disconnect
- ✅ **Dynamic Bot Presence** - Shows server count and helpful status information
- ✅ **Discord.js v14** - Latest Discord API features and optimizations
- ✅ **TypeScript Excellence** - Full type safety and modern development practices

## 🤝 Contributing

We welcome contributions to make XyBeat even better!

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes with proper testing
4. **Format** your code: `npm run format` (includes linting with auto-fix)
5. **Test** your changes thoroughly
6. **Submit** a pull request with a clear description

### 💡 Ideas for Contributions

- 🎵 Additional music sources (SoundCloud, Spotify integration)
- 🎨 Enhanced embed designs and user interfaces
- 🔊 Audio effects and filters
- 📊 Music statistics and analytics
- 🌐 Multi-language support
- 🎯 Performance optimizations

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**🎵 Built with ❤️ for music lovers and Discord communities**
