export type MessageType = 'message' | 'system' | 'media';

export type ChatMessage = {
  id: string;
  timestamp: Date;
  sender: string | null;
  text: string;
  type: MessageType;
  rawHeader?: string;
};

export type ChatMetadata = {
  totalMessages: number; // normal user messages only
  totalParticipants: number;
  participants: string[];
  firstMessageAt: Date | null;
  lastMessageAt: Date | null;
  durationDays: number;
  systemMessageCount: number;
  mediaMessageCount: number;
};
