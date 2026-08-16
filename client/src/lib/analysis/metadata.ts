import { ChatMessage, ChatMetadata } from '../../types/chat';

export function calculateMetadata(messages: ChatMessage[]): ChatMetadata {
  const normalMessages = messages.filter((m) => m.type === 'message');
  const systemMessages = messages.filter((m) => m.type === 'system');
  const mediaMessages = messages.filter((m) => m.type === 'media');

  const senderSet = new Set<string>();
  messages.forEach((m) => {
    if (m.sender) senderSet.add(m.sender);
  });
  const participants = Array.from(senderSet);

  let firstMessageAt: Date | null = null;
  let lastMessageAt: Date | null = null;

  if (messages.length > 0) {
    const sorted = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    firstMessageAt = sorted[0].timestamp;
    lastMessageAt = sorted[sorted.length - 1].timestamp;
  }

  let durationDays = 1;
  if (firstMessageAt && lastMessageAt) {
    const msDiff = Math.max(0, lastMessageAt.getTime() - firstMessageAt.getTime());
    durationDays = Math.max(1, Math.round(msDiff / (1000 * 60 * 60 * 24)));
  }

  return {
    totalMessages: normalMessages.length,
    totalParticipants: participants.length,
    participants,
    firstMessageAt,
    lastMessageAt,
    durationDays,
    systemMessageCount: systemMessages.length,
    mediaMessageCount: mediaMessages.length,
  };
}
