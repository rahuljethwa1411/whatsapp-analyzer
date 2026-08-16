import { ChatMessage } from '../../types/chat';
import { EmojiStats, EmojiFrequency } from '../../types/analysis';

// Unicode-aware Emoji Regex matching multi-codepoint emojis, skin tones, zero-width joiners
const EMOJI_REGEX = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu;

export function calculateEmojiStats(messages: ChatMessage[], participants: string[]): EmojiStats {
  const normalMessages = messages.filter((m) => m.type === 'message');

  const globalEmojiMap = new Map<string, number>();
  const participantEmojiMaps = new Map<string, Map<string, number>>();

  participants.forEach((p) => participantEmojiMaps.set(p, new Map<string, number>()));

  let totalCount = 0;

  normalMessages.forEach((m) => {
    const matches = m.text.match(EMOJI_REGEX);
    if (matches) {
      matches.forEach((emoji) => {
        totalCount++;

        // Global count
        globalEmojiMap.set(emoji, (globalEmojiMap.get(emoji) || 0) + 1);

        // Per participant count
        if (m.sender) {
          let pMap = participantEmojiMaps.get(m.sender);
          if (!pMap) {
            pMap = new Map<string, number>();
            participantEmojiMaps.set(m.sender, pMap);
          }
          pMap.set(emoji, (pMap.get(emoji) || 0) + 1);
        }
      });
    }
  });

  const sortedGlobal: EmojiFrequency[] = Array.from(globalEmojiMap.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);

  const mostUsedEmoji = sortedGlobal.length > 0 ? sortedGlobal[0].emoji : '💀';
  const mostUsedCount = sortedGlobal.length > 0 ? sortedGlobal[0].count : 0;

  const perParticipant: Record<string, EmojiFrequency[]> = {};
  participantEmojiMaps.forEach((pMap, name) => {
    perParticipant[name] = Array.from(pMap.entries())
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  });

  return {
    totalCount,
    uniqueCount: globalEmojiMap.size,
    mostUsedEmoji,
    mostUsedCount,
    topEmojis: sortedGlobal.slice(0, 15),
    perParticipant,
  };
}
