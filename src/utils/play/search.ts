import {
  CommandInteraction,
  EmbedBuilder,
  VoiceBasedChannel,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} from 'discord.js';
import { Logger } from '@/utils/logger';
import { isValidYouTubeUrl, searchYouTube, searchYouTubeMultiple, VideoInfo } from '@/utils/youtube';

export interface ResolvedQuery {
  url: string;
  /** Present when the query was a search; reused so the video isn't extracted twice. */
  info?: VideoInfo;
}
import { handleSingleVideo } from './video';

/**
 * Handles interactive search for songs
 * @param {string} query - Search query
 * @param {CommandInteraction} interaction - Command interaction
 * @param {VoiceBasedChannel} voiceChannel - Voice channel
 */
export async function handleSearch(
  query: string,
  interaction: CommandInteraction,
  voiceChannel: VoiceBasedChannel,
): Promise<void> {
  Logger.debug(`handleSearch: searching for "${query}"`);
  const results = await searchYouTubeMultiple(query, 10);

  if (results.length === 0) {
    await interaction.editReply({
      content: '❌ No results found. Please try another query.',
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`🔍 Search Results: ${query}`)
    .setDescription(
      results
        .map((video, index) => `${index + 1}. **${video.title}** (${video.duration})`)
        .join('\n'),
    )
    .setFooter({ text: 'Select a song to play from the menu below' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('search_select')
    .setPlaceholder('Choose a song...')
    .addOptions(
      results.slice(0, 25).map((video, index) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${index + 1}. ${video.title}`.slice(0, 100))
          .setDescription(video.duration)
          .setValue(video.url),
      ),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const response = await interaction.editReply({
    content: '✅ Found multiple results:',
    embeds: [embed],
    components: [row],
  });

  try {
    const confirmation = await response.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60000,
      componentType: ComponentType.StringSelect,
    });

    const selectedUrl = confirmation.values[0];
    if (!selectedUrl) return;
    const selected = results.find((video) => video.url === selectedUrl);

    await confirmation.update({
      content: '⌛ Processing your selection...',
      embeds: [],
      components: [],
    });

    await handleSingleVideo(selectedUrl, interaction, voiceChannel, selected);
  } catch (error) {
    Logger.debug('Search selection timed out or cancelled');
    await interaction.editReply({
      content: '❌ Search selection timed out.',
      embeds: [],
      components: [],
    });
  }
}

/**
 * Resolves query by verifying if it is a valid URL or searching YouTube
 * @param {string} query - Clean query
 * @param {CommandInteraction} interaction - Command interaction
 * @return {Promise<ResolvedQuery | null>} The resolved URL (plus info when searched), or null if error occurred
 */
export async function resolveQuery(query: string, interaction: CommandInteraction): Promise<ResolvedQuery | null> {
  const isValidUrl = isValidYouTubeUrl(query);
  Logger.debug(`play: isValidYouTubeUrl(query)=${isValidUrl}`);

  if (isValidUrl) {
    return { url: query };
  }

  // Try searching the query on YouTube
  Logger.debug(`play: searching for "${query}"`);
  const searchResult = await searchYouTube(query);
  if (!searchResult) {
    await interaction.editReply({
      content: '❌ No results found. Please provide a valid YouTube URL or query.',
    });
    return null;
  }

  Logger.debug(`play: found search result: ${searchResult.title}`);
  return { url: searchResult.url, info: searchResult };
}
