
export enum ViewMode {
  PLAYER = 'PLAYER',
  VEO_STUDIO = 'VEO_STUDIO',
  IMAGE_STUDIO = 'IMAGE_STUDIO',
  LIVE = 'LIVE',
}

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: 'video' | 'audio' | 'image';
  mimeType?: string;
  duration?: number;
  isStream?: boolean; // New flag for network streams
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isLoading?: boolean;
  images?: string[]; // Base64 strings
}

export interface VeoConfig {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p';
}

export interface ImageConfig {
  prompt: string;
  aspectRatio: '1:1' | '3:4' | '4:3' | '16:9';
  size: '1K' | '2K' | '4K';
}
