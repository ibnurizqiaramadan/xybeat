# XyBeat 🎵

A powerful Discord music bot built with TypeScript and discord.js v14, featuring YouTube playback that streams instantly and caches songs in the background.

## 🎵 Music-First Features

### 🚀 Core Music Engine

- 🎶 **Native yt-dlp Integration** - Direct binary usage for maximum reliability and quality
- ⚡ **Instant Streaming** - Uncached songs stream right away while the MP3 is downloaded in the background
- 💾 **Smart MP3 Caching** - Instant playback for previously downloaded songs
- 📻 **Radio Autoplay** - Keeps playing songs from the YouTube Mix of the last track when the queue ends
- 🎛️ **Now Playing Controls** - Pause/Resume, Skip, Stop and Radio buttons on the Now Playing message
- 📌 **24/7 Mode** - `/stay` keeps the bot in voice even when the channel is empty
- 🔍 **Advanced YouTube Search** - Search by song name, artist, or paste any YouTube URL
- 📋 **Comprehensive Playlist Support** - Handle YouTube playlists of any size, mixes, and radio stations
- ⏯️ **Full Playback Controls** - Play, pause, resume, skip, stop, and queue management
- 📄 **Interactive Queue Management** - Paginated display with navigation buttons
- 🎛️ **Voice Channel Integration** - Auto-join, auto-pause when alone, auto-leave after 5 minutes, queue kept after network loss
- 🔄 **Intelligent Fallbacks** - Graceful handling of private/restricted content
- 🎯 **Format Optimization** - Uses best available audio formats with MP3 conversion

### 🛠️ Technical Excellence

- 🚀 **TypeScript-Powered** - Full type safety and modern development experience
- ⚡ **Discord.js v14** - Latest Discord API features and performance optimizations
- 🎯 **Slash Commands** - Modern Discord command interface
- 📁 **Modular Architecture** - Clean, maintainable, and extensible codebase
- 🔧 **Hot Reload Development** - Fast iteration with `npm run watch`
- 🎨 **Rich Embeds** - Beautiful and informative Discord message displays
- 🛡️ **Robust Error Handling** - Comprehensive logging and graceful failure recovery
- 📊 **Monitoring** - `/ping` for latency, `/download-stats` for background download status

## Setup

### Prerequisites

- Node.js 22.12.0 or higher (or Docker)
- A Discord application and bot token
- **yt-dlp** binary installed (default `/snap/bin/yt-dlp`, override with `YTDLP_BIN` or bundled in Docker)
- **FFmpeg** binary installed (`/usr/bin/ffmpeg` or bundled in Docker)
- **Redis server** (optional) - For persistent queue storage across bot restarts

### Deployment via Docker (Recommended)

XyBeat includes a production-ready `Dockerfile` and `docker-compose.yml`.

1. Prepare your `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   # Edit with your DISCORD_TOKEN, CLIENT_ID, REDIS, etc.
   ```

2. Run with Docker Compose:
   ```bash
   docker compose up -d --build
   ```

3. View logs:
   ```bash
   docker logs -f xybeat
   ```

> **Note**: The Docker setup uses `network_mode: host` for minimal audio latency, optimal Discord UDP voice transmission, and seamless local Redis / proxy access. The MP3 directory can be mapped to a host folder (e.g., `~/music-bot/mp3`) and configured via `MUSIC_DIR`.

### CI/CD Deployment (GitHub Actions)

An automated deployment workflow (`.github/workflows/deploy.yml`) is included for self-hosted GitHub Actions runners:
- Builds the production image inside Docker.
- Ships the image to the target host over SSH without requiring an external image registry.
- Deploys container using `docker compose` with zero-downtime recreation.
- Managed via GitHub Repository Variables (`DEPLOY_HOST`, `DEPLOY_DIR`, `IMAGE`) and Secrets (`APP_ENV`).

### Manual System Dependencies (Without Docker)

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

   # Storage (Optional)
   MUSIC_DIR=             # default ~/music-bot/mp3 (custom cache folder or Docker volume)

   # yt-dlp (Optional)
   YTDLP_PROXY=           # e.g. socks5://127.0.0.1:40000 (Cloudflare WARP)
   YTDLP_BIN=             # default /snap/bin/yt-dlp; official yt-dlp_linux bundles the EJS solver
   ```

   **Redis Queue Persistence (Optional):**

   - Set `REDIS_ENABLED=true` to enable persistent queue storage
   - Queues (songs, autoplay, history) are saved per voice channel and expire after 1 hour
   - **Crash Recovery**: The current song and its position are saved every 5 seconds; on startup the bot rejoins and resumes from that position
   - **Auto-cleanup**: Playing states expire after 30 minutes and are not resumed when older
   - **24/7 Mode**: `/stay` is saved without expiry; the bot rejoins those voice channels on startup
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
| **📻 `/autoplay`**| **Toggle radio mode** - Keeps playing a YouTube Mix of similar songs when the queue ends     | Same as the **Radio** button on the Now Playing message                                                                                    |
| **📌 `/stay`**    | **Toggle 24/7 mode** - Stay in voice even when the channel is empty                         | Skips auto-pause and auto-disconnect, joins your channel if needed, survives restarts (Redis)                                              |
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
| **🛑 `/stop`**  | Stop playback only | ✅ **Preserved** | ✅ **Stays connected** | ⚠️ **Queue kept, playing state removed** | Stop now, `/play` later      |
| **🗑️ `/clear`** | Clear queue only   | ❌ **Cleared**   | ✅ **Stays connected** | ❌ **Removed**                           | Fresh start, keep connection |
| **👋 `/leave`** | Full disconnect    | ❌ **Cleared**   | ❌ **Disconnected**    | ❌ **Removed** (also turns off `/stay`)  | Complete exit from voice     |

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
| **📻 YouTube Mixes/Radio** | ✅ Smart Fallback | Loads the mix, or just the current video if the mix can't be read |
| **🔍 Search Queries**      | ✅ Full           | Search by song name, artist, or keywords     |
| **🔀 Mixed URLs**          | ✅ Smart          | Videos with playlist parameters              |

### 📊 Queue Management

- **📄 Paginated Display** - Shows 10 songs per page with interactive navigation
- **👤 User Control** - Only command user can navigate queue pages
- **⏰ Auto-timeout** - Navigation buttons disable after 5 minutes for performance

### 🎧 Audio Processing Pipeline

- **🎯 Format Selection** - yt-dlp picks `bestaudio`, falling back to format 18, then `best`
- **⚡ Instant Streaming** - Uncached songs stream through yt-dlp → FFmpeg without waiting for the download
- **🩹 Stream Recovery** - If the stream dies mid-song, playback resumes from the same position (up to 3 times)
- **🔄 MP3 Conversion** - Background downloads are converted to MP3 via FFmpeg
- **💾 Intelligent Caching** - Files stored in `~/music-bot/mp3/` directory
- **⚡ Instant Replay** - Cached files play immediately on repeat
- **🎛️ Smart Voice Management** - Auto-pause when alone, auto-disconnect after 5 minutes (disabled by `/stay` 24/7 mode)
- **🔌 Voice Recovery** - Short voice drops reconnect by themselves; after a network loss the queue is kept and `/play` rejoins (24/7 mode rejoins and resumes on its own)
- **🎛️ Multiple Disconnect Options** - Stop (preserve queue), Clear (remove songs), Leave (full disconnect)

### 🚀 Background Download System

- **⚡ Zero-Wait Playback** - Songs pre-download while music is playing, eliminating queue delays
- **🎯 Smart Prioritization** - Next song gets highest priority, followed by upcoming 5 songs in queue
- **⚙️ Concurrent Limits** - Maximum 2 downloads per server, 5 globally to prevent system overload
- **🔄 Automatic Retry** - Failed downloads retry with exponential backoff up to 3 times
- **💾 Cache Integration** - Automatically skips songs already downloaded, optimizes bandwidth
- **📊 Monitoring** - See queued, active and per-server downloads with `/download-stats`
- **🧹 Smart Cleanup** - Clears download queue when music queue is cleared or bot leaves voice
- **🔀 Shuffle Support** - Reorders background downloads when queue is shuffled for optimal experience

## Development

### Scripts

- `npm run dev` - Start bot in development mode (ts-node)
- `npm run watch` - Start bot with hot reload (nodemon)
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start the built bot
- `npm run deploy-commands` - Deploy slash commands (to `GUILD_ID` if set, otherwise globally)
- `npm run deploy-commands:global` - Deploy slash commands globally
- `npm run lint` - Run ESLint
- `npm run format` - Run ESLint with auto-fix

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
3. Restart the bot (commands are registered on startup; `npm run deploy-commands` also works without restarting)

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

- **Format**: `bestaudio`, falling back to format 18, then `best`
- **MP3 conversion**: Cached files are stored as MP3; uncached songs are streamed directly
- **Local caching**: Files stored locally for faster subsequent access
- **YouTube blocks / bot checks**: Set `YTDLP_PROXY` (e.g. Cloudflare WARP) or point `YTDLP_BIN` at the official `yt-dlp_linux`

## 🚀 What Makes XyBeat Special

### 🎵 Music-First Design

XyBeat was built from the ground up as a dedicated music bot, focusing on:

- **🎯 Reliability** - Native yt-dlp integration ensures consistent downloads
- **⚡ Performance** - Instant streaming plus background caching for optimal user experience
- **🔄 Flexibility** - Handles any YouTube content: videos, playlists, mixes, and searches
- **🎨 User Experience** - Now Playing message with button controls
- **🛡️ Robustness** - Graceful fallbacks for private/restricted content

### 🏗️ Technical Architecture

XyBeat uses a sophisticated multi-layer approach:

1. **🎶 yt-dlp Engine** - Direct binary integration for maximum compatibility
2. **⚡ Streaming Pipeline** - yt-dlp → FFmpeg → Discord voice, no wait for uncached songs
3. **🔄 FFmpeg Processing** - Audio conversion to MP3 for the cache
4. **💾 Smart Caching** - Local file system storage for instant replay
5. **🎛️ Discord Integration** - Optimized voice channel handling and embed displays
6. **🔧 Auto-Management** - Automatic command registration and resource cleanup

### ✨ Latest Features

- ✅ **🚀 Background Downloading** - Pre-downloads queued songs for instant playback, no more waiting!
- ✅ **⚡ Smart Download Queue** - Prioritizes next songs in queue with concurrent downloading (2-3 songs per server)
- ✅ **📊 Download Statistics** - Monitor background download queue and activity with `/download-stats` command
- ✅ **🎯 Intelligent Caching** - Automatically skips already downloaded songs, optimizes storage usage
- ✅ **Instant Streaming** - Uncached songs stream immediately instead of waiting for the download
- ✅ **Radio Autoplay** - Continues with a YouTube Mix of similar songs when the queue ends
- ✅ **Now Playing Controls** - Pause/Resume, Skip, Stop and Radio buttons
- ✅ **Auto Command Registration** - Commands automatically deployed on bot startup
- ✅ **Enhanced Playlist Support** - Smart fallbacks for YouTube mixes and radio, unlimited playlist size
- ✅ **Redis Queue Persistence** - Optional queue storage across bot restarts by voice channel
- ✅ **Crash Recovery System** - Resumes the current song at the same position after bot crashes/restarts
- ✅ **Separated Stop/Clear Commands** - Stop preserves queue, clear removes all songs
- ✅ **Smart Auto-Pause & Leave** - Automatically pause when alone, disconnect after 5min timeout
- ✅ **24/7 Mode** - `/stay` keeps the bot in voice even when empty, persisted in Redis across restarts
- ✅ **Queue Shuffle** - Randomize upcoming songs with Fisher-Yates algorithm (the playing song is untouched)
- ✅ **Complete Leave Command** - Full disconnect with queue clearing and data cleanup
- ✅ **Smart Voice Reconnection** - `/play` or `/resume` rejoins after auto-disconnect or network loss, queue kept
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
