import { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import {
  VoiceBasedChannel,
  User,
  Message,
  MessagePayload,
  MessageCreateOptions,
  BaseMessageOptions,
} from 'discord.js';
import { VideoInfo } from '@/utils/youtube/types';

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
  autoplay: boolean;
  lastSong: Song | null;
  history: string[];
  seekOffsetMs: number;
  /** Remaining YouTube Mix entries for radio autoplay (in-memory only). */
  radioPool?: VideoInfo[];
  /** URL of the last radio pick; a different lastSong means the user queued something new. */
  radioPickUrl?: string;
  /** Set while the current song streams; reports whether yt-dlp died mid-song. */
  streamFailed?: (() => boolean) | undefined;
  /** Mid-song stream resumes for the current song, capped to avoid loops. */
  streamResumes?: number;
  /** Current Now Playing message (or a "Starting..." placeholder) with the control buttons. */
  nowPlayingMessage?: NowPlayingMessage | undefined;
  /** Set by stop/clear/leave so the Idle handler doesn't advance to the next song. */
  stopped?: boolean;
}

export interface NowPlayingMessage {
  id: string;
  edit: (options: BaseMessageOptions) => Promise<unknown>;
  delete: () => Promise<unknown>;
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
  shuffleQueue: (guildId: string) => Promise<number>;
  leaveVoice: (guildId: string) => Promise<void>;
  addSongs: (guildId: string, songs: Song[]) => Promise<void>;
}
