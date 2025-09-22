import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  GuildMember,
  ChatInputCommandInteraction,
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
} from '@/utils/ytdlp';

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
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ You need to be in a voice channel to play music!',
        ephemeral: true,
      });
      return;
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user!);
    if (!permissions?.has(['Connect', 'Speak'])) {
      await interaction.reply({
        content: '❌ I need permissions to connect and speak in your voice channel!',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

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
          queue = musicManager.createQueue(
            interaction.guild.id,
            voiceChannel,
            interaction.channel as unknown as import('@/types/music').MinimalTextChannel,
          );
        }

        // Add all videos to queue
        for (const videoInfo of playlistVideos) {
          const song: Song = {
            title: videoInfo.title,
            url: videoInfo.url,
            duration: videoInfo.duration,
            thumbnail: videoInfo.thumbnail,
            requestedBy: interaction.user,
          };
          await musicManager.addSong(interaction.guild.id, song);
        }

        Logger.debug(
          `play: queued ${playlistVideos.length} songs from playlist for guild=${
            interaction.guild.id
          }`,
        );

        // Check if it's actually a single video or a real playlist
        if (playlistVideos.length === 1) {
          // Single video, show as normal video addition
          const video = playlistVideos[0];
          if (video) {
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

            await interaction.editReply({ embeds: [embed] });
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
        const videoInfo = await getVideoInfo(url);
        Logger.debug(`play: info.id=${videoInfo.id}, title="${videoInfo.title}"`);
        Logger.debug(`play: duration=${videoInfo.duration}, thumbnail=${!!videoInfo.thumbnail}`);

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
          queue = musicManager.createQueue(
            interaction.guild.id,
            voiceChannel,
            interaction.channel as unknown as import('@/types/music').MinimalTextChannel,
          );
        }

        // Add song to queue
        await musicManager.addSong(interaction.guild.id, song);
        Logger.debug(`play: queued song for guild=${interaction.guild.id}, title="${song.title}"`);

        const embed = new EmbedBuilder()
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
              value: queue.songs.length.toString(),
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

        await interaction.editReply({ embeds: [embed] });
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
        }
      }

      await interaction.editReply({
        content: errorMessage,
      });
    }
  },
};

export default command;
