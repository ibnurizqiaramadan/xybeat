/* eslint-disable valid-jsdoc, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { Song } from '@/types/music';

export interface SerializedSong {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
  requestedBy: {
    id: string;
    username: string;
    displayAvatarURL: string;
  };
}

export interface PlayingState {
  currentSong: SerializedSong;
  isPlaying: boolean;
  timestamp: number; // When this state was saved
  textChannelId?: string | undefined;
  playbackDurationMs?: number | undefined;
}

export interface MinimalUser {
  id: string;
  username: string;
  displayAvatarURL: () => string;
}
