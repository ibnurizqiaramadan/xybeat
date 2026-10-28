import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import { Logger } from '@/utils/logger';
import { MusicQueue, Song } from '@/types/music';

export const NOW_PLAYING_BUTTON = {
  pause: 'np:pause',
  skip: 'np:skip',
  stop: 'np:stop',
  radio: 'np:radio',
} as const;

/**
 * Build the Now Playing embed and its control buttons.
 * @param {MusicQueue} queue - Guild queue
 * @param {Song} song - Current song
 * @return {BaseMessageOptions} Message payload
 */
export function buildNowPlaying(queue: MusicQueue, song: Song): BaseMessageOptions {
  const paused = queue.player?.state.status === AudioPlayerStatus.Paused;
  const isRadioPick = song.url === queue.radioPickUrl;
  const next = queue.songs[0];
  const upNext = next ?
    `**${next.title}**${queue.songs.length > 1 ? ` (+${queue.songs.length - 1} more)` : ''}` :
    queue.autoplay ?
      '📻 Radio will pick a similar song' :
      'Nothing queued, add more with `/play`';

  const embed = new EmbedBuilder()
    .setColor(paused ? 0x808080 : isRadioPick ? 0x9b59b6 : 0x0099ff)
    .setTitle(`${paused ? '⏸️ Paused' : isRadioPick ? '📻 Now Playing · Radio' : '🎵 Now Playing'}`)
    .setDescription(`**[${song.title}](${song.url})**`)
    .addFields(
      { name: 'Duration', value: song.duration, inline: true },
      { name: 'Requested by', value: song.requestedBy.username, inline: true },
      { name: 'Up next', value: upNext, inline: false },
    );
  if (song.thumbnail) embed.setThumbnail(song.thumbnail);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(NOW_PLAYING_BUTTON.pause)
      .setEmoji(paused ? '▶️' : '⏸️')
      .setLabel(paused ? 'Resume' : 'Pause')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(NOW_PLAYING_BUTTON.skip)
      .setEmoji('⏭️')
      .setLabel('Skip')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(NOW_PLAYING_BUTTON.stop)
      .setEmoji('⏹️')
      .setLabel('Stop')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(NOW_PLAYING_BUTTON.radio)
      .setEmoji('📻')
      .setLabel(queue.autoplay ? 'Radio: On' : 'Radio: Off')
      .setStyle(queue.autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  return { content: '', embeds: [embed], components: [row] };
}

/**
 * Replace the previous Now Playing message with a fresh one at the bottom of the channel.
 * @param {MusicQueue} queue - Guild queue
 * @param {Song} song - Song that just started
 */
export async function showNowPlaying(queue: MusicQueue, song: Song): Promise<void> {
  await deleteNowPlaying(queue);
  try {
    queue.nowPlayingMessage = await queue.textChannel.send(buildNowPlaying(queue, song));
  } catch (error) {
    Logger.warn(`Failed to send Now Playing message: ${(error as Error).message}`);
  }
}

/**
 * Re-render the current Now Playing message, e.g. after pause, radio toggle or queue changes.
 * @param {MusicQueue} queue - Guild queue
 */
export async function refreshNowPlaying(queue: MusicQueue): Promise<void> {
  if (!queue.nowPlayingMessage || !queue.lastSong) return;
  await queue.nowPlayingMessage.edit(buildNowPlaying(queue, queue.lastSong)).catch(() => {});
}

/**
 * Delete the Now Playing message (or "Starting..." placeholder) entirely.
 * @param {MusicQueue} queue - Guild queue
 */
export async function deleteNowPlaying(queue: MusicQueue): Promise<void> {
  const message = queue.nowPlayingMessage;
  queue.nowPlayingMessage = undefined;
  await message?.delete().catch(() => {});
}

/**
 * Drop the controls from the Now Playing message once nothing is playing.
 * @param {MusicQueue} queue - Guild queue
 */
export async function retireNowPlaying(queue: MusicQueue): Promise<void> {
  const message = queue.nowPlayingMessage;
  queue.nowPlayingMessage = undefined;
  await message?.edit({ components: [] }).catch(() => {});
}
