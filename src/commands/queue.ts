import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ButtonInteraction,
  MessageFlags,
} from 'discord.js';
import { Command } from '@/types';
import { musicManager } from '@/utils/musicManager';
import { MusicQueue, Song } from '@/types/music';

const SONGS_PER_PAGE = 10;

/**
 * Create queue embed for a specific page
 * @param {MusicQueue} queue - Music queue object
 * @param {number} page - Current page number (0-indexed)
 * @return {EmbedBuilder} Queue embed
 */
function createQueueEmbed(queue: MusicQueue, page: number): EmbedBuilder {
  const totalPages = Math.ceil(queue.songs.length / SONGS_PER_PAGE);
  const startIndex = page * SONGS_PER_PAGE;
  const endIndex = Math.min(startIndex + SONGS_PER_PAGE, queue.songs.length);

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('🎵 Music Queue')
    .setDescription(`**${queue.songs.length} song(s) in queue**`)
    .setTimestamp();

  // Get songs for current page
  const queueList = queue.songs
    .slice(startIndex, endIndex)
    .map((song: Song, index: number) => {
      const songNumber = startIndex + index + 1;
      return `${songNumber}. **${song.title}** (${song.duration}) - ${song.requestedBy.username}`;
    })
    .join('\n');

  embed.addFields({
    name: 'Songs',
    value: queueList || 'No songs in queue',
    inline: false,
  });

  // Add current playing status
  if (queue.playing) {
    embed.addFields({
      name: 'Status',
      value: '▶️ Currently playing',
      inline: true,
    });
  } else {
    embed.addFields({
      name: 'Status',
      value: '⏸️ Paused',
      inline: true,
    });
  }

  embed.addFields({
    name: 'Voice Channel',
    value: queue.voiceChannel.name,
    inline: true,
  });

  // Add pagination info
  if (totalPages > 1) {
    embed.setFooter({
      text: `Page ${page + 1} of ${totalPages}`,
    });
  }

  return embed;
}

/**
 * Create navigation buttons for pagination
 * @param {number} currentPage - Current page number (0-indexed)
 * @param {number} totalPages - Total number of pages
 * @return {ActionRowBuilder} Button row
 */
function createNavigationButtons(
  currentPage: number,
  totalPages: number,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  // First page button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('queue_first')
      .setLabel('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
  );

  // Previous page button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('queue_prev')
      .setLabel('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
  );

  // Page info button (disabled, just for display)
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('queue_info')
      .setLabel(`${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
  );

  // Next page button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('queue_next')
      .setLabel('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages - 1),
  );

  // Last page button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('queue_last')
      .setLabel('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages - 1),
  );

  return row;
}

const command: Command = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Show the current music queue'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue || queue.songs.length === 0) {
      await interaction.reply({
        content: '❌ The music queue is empty!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const totalPages = Math.ceil(queue.songs.length / SONGS_PER_PAGE);
    let currentPage = 0;

    const embed = createQueueEmbed(queue, currentPage);
    const components = totalPages > 1 ? [createNavigationButtons(currentPage, totalPages)] : [];

    await interaction.reply({
      embeds: [embed],
      components,
    });

    const response = await interaction.fetchReply();

    // If there's only one page, no need for interaction handling
    if (totalPages <= 1) {
      return;
    }

    // Create collector for button interactions
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes
    });

    collector.on('collect', async(buttonInteraction: ButtonInteraction) => {
      // Check if the user who clicked is the same as who used the command
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: '❌ Only the user who used the command can navigate the queue!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Get updated queue (in case it changed)
      const updatedQueue = musicManager.getQueue(interaction.guild!.id);
      if (!updatedQueue || updatedQueue.songs.length === 0) {
        await buttonInteraction.update({
          content: '❌ The music queue is now empty!',
          embeds: [],
          components: [],
        });
        return;
      }

      const updatedTotalPages = Math.ceil(updatedQueue.songs.length / SONGS_PER_PAGE);

      // Handle navigation
      switch (buttonInteraction.customId) {
      case 'queue_first':
        currentPage = 0;
        break;
      case 'queue_prev':
        currentPage = Math.max(0, currentPage - 1);
        break;
      case 'queue_next':
        currentPage = Math.min(updatedTotalPages - 1, currentPage + 1);
        break;
      case 'queue_last':
        currentPage = updatedTotalPages - 1;
        break;
      }

      // Make sure current page is within bounds
      currentPage = Math.min(currentPage, updatedTotalPages - 1);
      currentPage = Math.max(0, currentPage);

      const newEmbed = createQueueEmbed(updatedQueue, currentPage);
      const newComponents =
        updatedTotalPages > 1 ? [createNavigationButtons(currentPage, updatedTotalPages)] : [];

      await buttonInteraction.update({
        embeds: [newEmbed],
        components: newComponents,
      });
    });

    collector.on('end', async() => {
      // Disable all buttons when collector expires
      const disabledRow = new ActionRowBuilder<ButtonBuilder>();
      const buttons = [
        new ButtonBuilder()
          .setCustomId('queue_first')
          .setLabel('⏮️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('queue_prev')
          .setLabel('◀️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('queue_info')
          .setLabel(`${currentPage + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('queue_next')
          .setLabel('▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('queue_last')
          .setLabel('⏭️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      ];

      disabledRow.addComponents(...buttons);

      try {
        await interaction.editReply({
          components: [disabledRow],
        });
      } catch (error) {
        // Ignore errors if message was already deleted
      }
    });
  },
};

export default command;
