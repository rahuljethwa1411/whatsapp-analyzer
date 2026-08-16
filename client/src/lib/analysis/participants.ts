import { ChatMessage } from '../../types/chat';
import { ParticipantStats } from '../../types/analysis';

export function calculateParticipantStats(
  messages: ChatMessage[],
  participants: string[]
): ParticipantStats[] {
  const normalMessages = messages.filter((m) => m.type === 'message');
  const totalNormal = normalMessages.length || 1;

  const statsMap = new Map<
    string,
    {
      messageCount: number;
      firstMessageAt: Date | null;
      lastMessageAt: Date | null;
      mediaCount: number;
      wordCount: number;
      emojiCount: number;
    }
  >();

  participants.forEach((p) => {
    statsMap.set(p, {
      messageCount: 0,
      firstMessageAt: null,
      lastMessageAt: null,
      mediaCount: 0,
      wordCount: 0,
      emojiCount: 0,
    });
  });

  messages.forEach((m) => {
    if (!m.sender) return;
    let pStats = statsMap.get(m.sender);
    if (!pStats) {
      pStats = {
        messageCount: 0,
        firstMessageAt: null,
        lastMessageAt: null,
        mediaCount: 0,
        wordCount: 0,
        emojiCount: 0,
      };
      statsMap.set(m.sender, pStats);
    }

    if (m.type === 'message') {
      pStats.messageCount++;
      if (!pStats.firstMessageAt) pStats.firstMessageAt = m.timestamp;
      pStats.lastMessageAt = m.timestamp;

      // Word count
      const words = m.text.trim().split(/\s+/).filter((w) => w.length > 0);
      pStats.wordCount += words.length;
    } else if (m.type === 'media') {
      pStats.mediaCount++;
    }
  });

  return Array.from(statsMap.entries()).map(([name, s]) => {
    const percentage = Math.round((s.messageCount / totalNormal) * 100);
    const avgWordsPerMessage = s.messageCount > 0 ? Math.round((s.wordCount / s.messageCount) * 10) / 10 : 0;

    return {
      name,
      messageCount: s.messageCount,
      percentage,
      firstMessageAt: s.firstMessageAt,
      lastMessageAt: s.lastMessageAt,
      mediaCount: s.mediaCount,
      emojiCount: s.emojiCount,
      wordCount: s.wordCount,
      avgWordsPerMessage,
    };
  });
}
