import { ButtonInteraction, MessageFlags } from 'discord.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import { musicManager } from '@/utils/musicManager';
import { validateVoiceConnection } from '@/utils/commandHelper';
import { NOW_PLAYING_BUTTON, refreshNowPlaying } from '@/utils/music/nowPlaying';

/**
 * Handle a click on one of the Now Playing control buttons.
 * @param {ButtonInteraction} interaction - Button interaction
 */
export async function handleNowPlayingButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;
  const voiceChannel = await validateVoiceConnection(interaction, true);
  if (!voiceChannel) return;

  const guildId = interaction.guild.id;
  const queue = musicManager.getQueue(guildId);
  if (!queue?.lastSong || queue.nowPlayingMessage?.id !== interaction.message.id) {
    await interaction.reply({ content: '❌ This song is no longer playing.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Acknowledge within Discord's 3s window; the Now Playing message itself is the feedback.
  await interaction.deferUpdate();

  switch (interaction.customId) {
  case NOW_PLAYING_BUTTON.pause:
    if (queue.player?.state.status === AudioPlayerStatus.Paused) {
      musicManager.resume(guildId);
    } else {
      musicManager.pause(guildId);
    }
    break;
  case NOW_PLAYING_BUTTON.skip:
    musicManager.skip(guildId);
    break;
  case NOW_PLAYING_BUTTON.stop:
    await musicManager.stop(guildId);
    break;
  case NOW_PLAYING_BUTTON.radio:
    queue.autoplay = !queue.autoplay;
    await musicManager.saveQueue(guildId);
    await refreshNowPlaying(queue);
    break;
  }
}
