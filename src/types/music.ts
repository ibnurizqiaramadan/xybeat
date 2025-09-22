import { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import { VoiceBasedChannel, User, Message, MessagePayload, MessageCreateOptions } from 'discord.js';

export interface MinimalTextChannel {
  send: (options: string | MessagePayload | MessageCreateOptions) => Promise<Message>;
}

export interface Song {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
  requestedBy: User;
}

export interface MusicQueue {
  textChannel: MinimalTextChannel;
  voiceChannel: VoiceBasedChannel;
  connection: VoiceConnection | null;
  songs: Song[];
  volume: number;
  playing: boolean;
  player: AudioPlayer | null;
}

export interface MusicManager {
  queues: Map<string, MusicQueue>;
  createQueue: (
    guildId: string,
    voiceChannel: VoiceBasedChannel,
    textChannel: MinimalTextChannel
  ) => Promise<MusicQueue>;
  getQueue: (guildId: string) => MusicQueue | undefined;
  deleteQueue: (guildId: string) => void;
  clearQueue: (guildId: string) => Promise<void>;
  stop: (guildId: string) => Promise<void>;
  resumeFromCrash: (guildId: string) => Promise<boolean>;
  disconnectVoice: (guildId: string) => Promise<void>;
  isVoiceChannelEmpty: (guildId: string) => boolean;
}
