import { ChatMessage } from '../../types/chat';
import { WordStats, WordFrequency } from '../../types/analysis';

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
  'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
  'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up',
  'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
  'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
  'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
  'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were',
  'am', 'been', 'being', 'had', 'has', 'did', 'does', 'doing', 'ok', 'okay', 'yeah', 'yes',
]);

export function calculateWordStats(messages: ChatMessage[], participants: string[]): WordStats {
  const normalMessages = messages.filter((m) => m.type === 'message');

  const globalWordMap = new Map<string, number>();
  const participantWordMaps = new Map<string, Map<string, number>>();

  participants.forEach((p) => participantWordMaps.set(p, new Map<string, number>()));

  let totalWords = 0;

  normalMessages.forEach((m) => {
    // Strip emojis and punctuation, convert to lowercase
    const cleanText = m.text.toLowerCase().replace(/[^\w\s]/gi, ' ');
    const tokens = cleanText.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));

    tokens.forEach((w) => {
      totalWords++;
      globalWordMap.set(w, (globalWordMap.get(w) || 0) + 1);

      if (m.sender) {
        let pMap = participantWordMaps.get(m.sender);
        if (!pMap) {
          pMap = new Map<string, number>();
          participantWordMaps.set(m.sender, pMap);
        }
        pMap.set(w, (pMap.get(w) || 0) + 1);
      }
    });
  });

  const sortedGlobal: WordFrequency[] = Array.from(globalWordMap.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  const perParticipant: Record<string, WordFrequency[]> = {};
  participantWordMaps.forEach((pMap, name) => {
    perParticipant[name] = Array.from(pMap.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  });

  return {
    totalWords,
    uniqueWords: globalWordMap.size,
    topWords: sortedGlobal.slice(0, 20),
    perParticipant,
  };
}
