import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  GuildMember,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';
import { Song } from '@/types/music';
import { Logger } from '@/utils/logger';
import {
  getVideoInfo,
  isValidYouTubeUrl,
  searchYouTube,
  isPlaylistUrl,
  getPlaylistInfo,
  DownloadProgress,
} from '@/utils/ytdlp';

/**
 * Create progress embed for download progress
 * @param {string} title - Song title
 * @param {DownloadProgress} progress - Download progress data
 * @return {EmbedBuilder} Progress embed
 */
function createProgressEmbed(title: string, progress: DownloadProgress): EmbedBuilder {
  // Check if this is a cached file
  if (progress.downloaded === 'Cached') {
    return new EmbedBuilder()
      .setColor(0x00ff00) // Green for cached
      .setTitle('💾 Loading from Cache...')
      .setDescription(`**${title}**`)
      .addFields(
        {
          name: 'Status',
          value: '✅ File already downloaded',
          inline: false,
        },
        {
          name: 'Speed',
          value: 'Instant',
          inline: true,
        },
      )
      .setTimestamp();
  }

  const progressBar = createProgressBar(progress.percentage);

  return new EmbedBuilder()
    .setColor(0xffa500) // Orange color for progress
    .setTitle('⬇️ Downloading...')
    .setDescription(`**${title}**`)
    .addFields(
      {
        name: 'Progress',
        value: `${progressBar} ${progress.percentage.toFixed(1)}%`,
        inline: false,
      },
      {
        name: 'Downloaded',
        value: `${progress.downloaded} / ${progress.total}`,
        inline: true,
      },
      {
        name: 'Speed',
        value: progress.speed,
        inline: true,
      },
      {
        name: 'ETA',
        value: progress.eta,
        inline: true,
      },
    )
    .setTimestamp();
}

/**
 * Create a visual progress bar
 * @param {number} percentage - Progress percentage (0-100)
 * @return {string} Progress bar string
 */
function createProgressBar(percentage: number): string {
  const length = 20;
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play music from YouTube (supports videos and playlists)')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('YouTube URL, playlist URL, or search query')
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: CommandInteraction) {
    Logger.debug('=== PLAY COMMAND STARTED ===');
    Logger.debug(`User: ${interaction.user.username}, Guild: ${interaction.guild?.name}`);

    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ You need to be in a voice channel to play music!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user!);
    if (!permissions?.has(['Connect', 'Speak'])) {
      await interaction.reply({
        content: '❌ I need permissions to connect and speak in your voice channel!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    Logger.debug('Deferring reply...');
    await interaction.deferReply();
    Logger.debug('Reply deferred successfully');

    // Send immediate response to prevent timeout
    await interaction.editReply({
      content: '🔍 Processing your request...',
    });

    const rawQuery = (interaction as ChatInputCommandInteraction).options.getString('query', true);
    const query = rawQuery
      .trim()
      .replace(/^@+/, '')
      .replace(/^<+|>+$/g, '');
    Logger.debug(`play: raw="${rawQuery}", sanitized="${query}"`);
    let url = query;

    // Validate or search query
    const isValidUrl = isValidYouTubeUrl(query);
    Logger.debug(`play: isValidYouTubeUrl(query)=${isValidUrl}`);
    if (!isValidUrl) {
      // Try searching the query on YouTube
      Logger.debug(`play: searching for "${query}"`);
      const searchResult = await searchYouTube(query);
      if (!searchResult) {
        await interaction.editReply({
          content: '❌ No results found. Please provide a valid YouTube URL or query.',
        });
        return;
      }
      Logger.debug(`play: found search result: ${searchResult.title}`);
      url = searchResult.url;
    }

    // Final guard to ensure url is a valid YouTube URL
    if (!isValidYouTubeUrl(url)) {
      Logger.debug(`play: final guard failed, url=${url}`);
      await interaction.editReply({
        content:
          '❌ Invalid YouTube URL detected after processing. Please try another link or query.',
      });
      return;
    }

    try {
      // Check if it's a playlist URL
      if (isPlaylistUrl(url)) {
        Logger.debug(`play: detected playlist URL, fetching playlist info for url=${url}`);
        const playlistVideos = await getPlaylistInfo(url);
        if (playlistVideos.length === 0) {
          await interaction.editReply({
            content: '❌ No videos found in this playlist or playlist is private.',
          });
          return;
        }

        Logger.debug(`play: found ${playlistVideos.length} videos in playlist`);

        // Get or create queue
        let queue = musicManager.getQueue(interaction.guild.id);
        if (!queue) {
          if (!interaction.channel) {
            await interaction.editReply({
              content: '❌ Could not access the text channel!',
            });
            return;
          }
          queue = await musicManager.createQueue(
            interaction.guild.id,
            voiceChannel,
            interaction.channel as unknown as import('@/types/music').MinimalTextChannel,
          );
        }

        // Set up progress callback for the first song if queue is empty
        if (queue.songs.length === 0 && playlistVideos.length > 0) {
          Logger.debug('Setting up progress callback for playlist first song');
          const firstSong = playlistVideos[0];
          if (firstSong) {
            let lastProgressUpdate = 0;
            const progressCallback = async(progress: DownloadProgress) => {
              Logger.debug(`Progress callback triggered: ${progress.percentage}%`);

              // Update only every 2 seconds to avoid rate limiting
              const now = Date.now();
              if (now - lastProgressUpdate < 2000) {
                Logger.debug(`Progress update skipped (rate limit): ${progress.percentage}%`);
                return;
              }
              lastProgressUpdate = now;

              try {
                Logger.debug(`Updating progress embed: ${progress.percentage}%`);
                const progressEmbed = createProgressEmbed(firstSong.title, progress);
                await interaction.editReply({ embeds: [progressEmbed] });
                Logger.debug('Progress embed updated successfully');

                // If download is complete (100% or cached), show final message after a short delay
                if (progress.percentage >= 100 || progress.downloaded === 'Cached') {
                  Logger.debug('Download complete, will remove progress display shortly');
                  setTimeout(async() => {
                    try {
                      const finalEmbed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Ready to Play')
                        .setDescription(`**${firstSong.title}**`)
                        .addFields(
                          {
                            name: 'Status',
                            value: 'Download complete, starting playback...',
                            inline: false,
                          },
                        )
                        .setTimestamp();

                      await interaction.editReply({ embeds: [finalEmbed] });
                      Logger.debug('Final download complete embed sent');
                    } catch (error) {
                      Logger.warn(`Failed to send final embed: ${(error as Error).message}`);
                    }
                  }, 1500); // Wait 1.5 seconds before showing final message
                }
              } catch (error) {
                // Ignore errors during progress updates to avoid breaking the flow
                Logger.warn(`Failed to update progress: ${(error as Error).message}`);
              }
            };

            // Set the progress callback for this guild
            musicManager.setProgressCallback(interaction.guild.id, progressCallback);

            // Remove the callback after 5 minutes to prevent memory leaks
            setTimeout(() => {
              musicManager.removeProgressCallback(interaction.guild!.id);
            }, 5 * 60 * 1000);
          }
        }

        // Convert all videos to songs and add to queue efficiently
        const songs: Song[] = playlistVideos.map((videoInfo) => ({
          title: videoInfo.title,
          url: videoInfo.url,
          duration: videoInfo.duration,
          thumbnail: videoInfo.thumbnail,
          requestedBy: interaction.user,
        }));

        // Add all songs at once (triggers background downloading automatically)
        await musicManager.addSongs(interaction.guild.id, songs);

        Logger.debug(
          `play: queued ${playlistVideos.length} songs from playlist for guild=${
            interaction.guild.id
          }`,
        );

        // Check if it's actually a single video or a real playlist
        if (playlistVideos.length === 1) {
          // Single video, show as normal video addition
          Logger.debug('Playlist fallback: showing single video embed');
          const video = playlistVideos[0];
          if (video) {
            Logger.debug(`Single video from fallback: ${video.title}`);
            const embed = new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle('✅ Added to Queue')
              .setDescription(`**${video.title}**`)
              .addFields(
                {
                  name: 'Duration',
                  value: video.duration,
                  inline: true,
                },
                {
                  name: 'Position in Queue',
                  value: queue.songs.length.toString(),
                  inline: true,
                },
                {
                  name: 'Requested by',
                  value: interaction.user.username,
                  inline: true,
                },
              )
              .setThumbnail(video.thumbnail)
              .setTimestamp();

            Logger.debug('Sending single video embed...');
            await interaction.editReply({ embeds: [embed] });
            Logger.debug('Single video embed sent successfully');
          }
        } else {
          // Multiple videos, show as playlist
          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('📋 Playlist Added to Queue')
            .setDescription(`Added **${playlistVideos.length}** songs to the queue`)
            .addFields(
              {
                name: 'Total Songs',
                value: playlistVideos.length.toString(),
                inline: true,
              },
              {
                name: 'Queue Size',
                value: queue.songs.length.toString(),
                inline: true,
              },
              {
                name: 'Requested by',
                value: interaction.user.username,
                inline: true,
              },
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        }
      } else {
        // Single video handling
        Logger.debug(`play: fetching video_info for url=${url}`);
        let videoInfo;
        try {
          videoInfo = await getVideoInfo(url);
          Logger.debug(`play: info.id=${videoInfo.id}, title="${videoInfo.title}"`);
          Logger.debug(`play: duration=${videoInfo.duration}, thumbnail=${!!videoInfo.thumbnail}`);
        } catch (videoInfoError) {
          Logger.error('Failed to get video info:', videoInfoError as Error);
          await interaction.editReply({
            content: '❌ Failed to get video information. Please try another video.',
          });
          return;
        }

        const song: Song = {
          title: videoInfo.title,
          url: videoInfo.url,
          duration: videoInfo.duration,
          thumbnail: videoInfo.thumbnail,
          requestedBy: interaction.user,
        };

        // Get or create queue
        let queue = musicManager.getQueue(interaction.guild.id);
        if (!queue) {
          if (!interaction.channel) {
            await interaction.editReply({
              content: '❌ Could not access the text channel!',
            });
            return;
          }
          queue = await musicManager.createQueue(
            interaction.guild.id,
            voiceChannel,
            interaction.channel as unknown as import('@/types/music').MinimalTextChannel,
          );
        }

        // Show initial "Added to Queue" message
        const initialEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Added to Queue')
          .setDescription(`**${song.title}**`)
          .addFields(
            {
              name: 'Duration',
              value: song.duration,
              inline: true,
            },
            {
              name: 'Position in Queue',
              value: (queue.songs.length + 1).toString(), // +1 because we haven't added yet
              inline: true,
            },
            {
              name: 'Requested by',
              value: song.requestedBy.username,
              inline: true,
            },
          )
          .setThumbnail(song.thumbnail)
          .setTimestamp();

        Logger.debug('Sending initial "Added to Queue" embed...');
        await interaction.editReply({ embeds: [initialEmbed] });
        Logger.debug('Initial embed sent successfully');

        // Set up progress callback BEFORE adding song to queue
        // If this will be the first song, it will start downloading immediately
        if (queue.songs.length === 0) {
          // Set up progress callback for downloads
          let lastProgressUpdate = 0;
          const progressCallback = async(progress: DownloadProgress) => {
            Logger.debug(`Progress callback triggered: ${progress.percentage}%`);

            // Update only every 2 seconds to avoid rate limiting
            const now = Date.now();
            if (now - lastProgressUpdate < 2000) {
              Logger.debug(`Progress update skipped (rate limit): ${progress.percentage}%`);
              return;
            }
            lastProgressUpdate = now;

            try {
              Logger.debug(`Updating progress embed: ${progress.percentage}%`);
              const progressEmbed = createProgressEmbed(song.title, progress);
              await interaction.editReply({ embeds: [progressEmbed] });
              Logger.debug('Progress embed updated successfully');

              // If download is complete (100% or cached), show final message after a short delay
              if (progress.percentage >= 100 || progress.downloaded === 'Cached') {
                Logger.debug('Download complete, will remove progress display shortly');
                setTimeout(async() => {
                  try {
                    const finalEmbed = new EmbedBuilder()
                      .setColor(0x00ff00)
                      .setTitle('✅ Ready to Play')
                      .setDescription(`**${song.title}**`)
                      .addFields(
                        {
                          name: 'Status',
                          value: 'Download complete, starting playback...',
                          inline: false,
                        },
                      )
                      .setTimestamp();

                    await interaction.editReply({ embeds: [finalEmbed] });
                    Logger.debug('Final download complete embed sent');
                  } catch (error) {
                    Logger.warn(`Failed to send final embed: ${(error as Error).message}`);
                  }
                }, 1500); // Wait 1.5 seconds before showing final message
              }
            } catch (error) {
              // Ignore errors during progress updates to avoid breaking the flow
              Logger.warn(`Failed to update progress: ${(error as Error).message}`);
            }
          };

          // Set the progress callback for this guild BEFORE adding song
          musicManager.setProgressCallback(interaction.guild.id, progressCallback);

          // Remove the callback after 5 minutes to prevent memory leaks
          setTimeout(() => {
            musicManager.removeProgressCallback(interaction.guild!.id);
          }, 5 * 60 * 1000);
        }

        // Add song to queue (this may trigger download if first song)
        Logger.debug(`Adding song to queue. Current queue length: ${queue.songs.length}`);
        await musicManager.addSong(interaction.guild.id, song);
        Logger.debug(`play: queued song for guild=${interaction.guild.id}, title="${song.title}"`);
        Logger.debug(`Queue length after adding: ${queue.songs.length}`);
      }
    } catch (error) {
      Logger.error('Error in play command', error as Error);
      let errorMessage = '❌ An error occurred while trying to play this song.';

      if (error instanceof Error) {
        if (error.message.includes('Video unavailable')) {
          errorMessage = '❌ This video is unavailable or private.';
        } else if (error.message.includes('Could not extract')) {
          errorMessage = '❌ Unable to extract audio from this video. Try another video.';
        } else if (error.message.includes('Age restricted')) {
          errorMessage = '❌ This video is age-restricted and cannot be played.';
        } else if (
          error.message.includes('playlist type is unviewable') ||
          error.message.includes('This playlist type is unviewable')
        ) {
          errorMessage = '❌ This playlist type (YouTube Mix/Radio) cannot be accessed. ' +
            'Please use a regular playlist or single video.';
        }
      }

      await interaction.editReply({
        content: errorMessage,
      });
    }
  },
};

export default command;
