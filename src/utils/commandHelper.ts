import { CommandInteraction, GuildMember, MessageFlags, VoiceBasedChannel } from 'discord.js';

/**
 * Validates that the user is in a voice channel, and if the bot is also in a voice channel,
 * verifies they are in the same channel.
 *
 * @param {CommandInteraction} interaction - The command interaction.
 * @param {boolean} checkSameChannel - Whether to check if user is in the same channel as the bot.
 * @return {Promise<VoiceBasedChannel | null>} The user's voice channel if validation passes, null otherwise.
 */
export async function validateVoiceConnection(
  interaction: CommandInteraction,
  checkSameChannel: boolean = true,
): Promise<VoiceBasedChannel | null> {
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server!',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ You need to be in a voice channel to use music commands!',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  if (checkSameChannel) {
    const botVoiceChannel = interaction.guild.members.me?.voice.channel;
    if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id) {
      await interaction.reply({
        content: '❌ You need to be in the same voice channel as me to use music commands!',
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }
  }

  return voiceChannel;
}

/**
 * Verifies if the bot has Connect and Speak permissions in the target channel.
 *
 * @param {VoiceBasedChannel} voiceChannel - The voice channel.
 * @param {CommandInteraction} interaction - The command interaction.
 * @param {string} customMessage - Custom error message if bot lacks permissions.
 * @return {Promise<boolean>} True if bot has permissions, false otherwise.
 */
export async function validateBotPermissions(
  voiceChannel: VoiceBasedChannel,
  interaction: CommandInteraction,
  customMessage: string = '❌ I need permissions to connect and speak in your voice channel!',
): Promise<boolean> {
  const permissions = voiceChannel.permissionsFor(interaction.client.user!);
  if (!permissions?.has(['Connect', 'Speak'])) {
    await interaction.reply({
      content: customMessage,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}
