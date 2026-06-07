import { EmbedBuilder } from 'discord.js';
import { DownloadProgress } from '@/utils/ytdlp';

/**
 * Create a visual progress bar
 * @param {number} percentage - Progress percentage (0-100)
 * @return {string} Progress bar string
 */
export function createProgressBar(percentage: number): string {
  const length = 20;
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Create progress embed for download progress
 * @param {string} title - Song title
 * @param {DownloadProgress} progress - Download progress data
 * @return {EmbedBuilder} Progress embed
 */
export function createProgressEmbed(title: string, progress: DownloadProgress): EmbedBuilder {
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
