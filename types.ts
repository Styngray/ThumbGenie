
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  imageUrl?: string; // If the message includes an image (e.g. model output)
  isError?: boolean;
}

export interface Layer {
  id: string;
  name: string;
  type: 'image' | 'text' | 'group';
  visible: boolean;
  expanded?: boolean; // For groups
  src?: string; // Base64 content for image/text
  children?: Layer[];
  opacity?: number;
  blendMode?: string;
}

export interface AppState {
  currentImage: string | null; // Base64 string (Composite)
  layers: Layer[];
  history: Message[];
  isLoading: boolean;
  isDragging: boolean;
}

export interface Folder {
  id: string;
  name: string;
  timestamp: number;
  parentId?: string;
}

export interface Project {
  id: string;
  name: string;
  thumbnail: string;
  timestamp: number;
  folderId?: string;
  data?: {
    currentImage: string | null;
    layers?: Layer[]; // New field for layers
    imageHistory: string[]; // Keep for legacy/fallback
    historyIndex: number;
    messages: Message[];
  };
}
