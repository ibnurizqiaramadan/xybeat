import { CommandInteraction, EmbedBuilder } from 'discord.js';
import { Logger } from '@/utils/logger';
import { DownloadProgress } from '@/utils/youtube';
import { musicManager } from '@/utils/music';
import { createProgressEmbed } from './embeds';

/**
 * Sets up progress callback for downloading a song
 * @param {string} guildId - Guild ID
 * @param {string} title - Song title
 * @param {CommandInteraction} interaction - Command interaction
 */
export function setupDownloadProgressCallback(
  guildId: string,
  title: string,
  interaction: CommandInteraction,
): void {
  let lastProgressUpdate = 0;
  const progressCallback = async(progress: DownloadProgress) => {
    Logger.debug(`Progress callback triggered: ${progress.percentage}%`);

    // Update only every 2 seconds to avoid rate limiting
    const now = Date.now();
    const isFinished = progress.percentage >= 100 || progress.downloaded === 'Cached';
    if (!isFinished && now - lastProgressUpdate < 2000) {
      Logger.debug(`Progress update skipped (rate limit): ${progress.percentage}%`);
      return;
    }
    lastProgressUpdate = now;

    try {
      Logger.debug(`Updating progress embed: ${progress.percentage}%`);
      const progressEmbed = createProgressEmbed(title, progress);
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
              .setDescription(`**${title}**`)
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
      Logger.warn(`Failed to update progress: ${(error as Error).message}`);
    }
  };

  // Set the progress callback for this guild
  musicManager.setProgressCallback(guildId, progressCallback);

  // Remove the callback after 5 minutes to prevent memory leaks
  setTimeout(() => {
    musicManager.removeProgressCallback(guildId);
  }, 5 * 60 * 1000);
}
