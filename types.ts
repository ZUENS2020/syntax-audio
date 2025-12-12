export interface Track {
  id: string;
  file?: File;
  name: string;
  url: string;
  duration?: number;
  isFavorite?: boolean;
  source: 'local' | 'rss';
  blob?: Blob; // Used for restoring local files from storage
  workspaceId?: string; // Links track to a specific workspace
}

export interface Workspace {
  id: string;
  name: string;
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export type PlayMode = 'linear' | 'random' | 'loop';
