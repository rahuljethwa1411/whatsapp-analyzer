import { ChatMessage } from '../../types/chat';
import { ResponseTimeStats } from '../../types/analysis';

const MAX_RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export function calculateResponseTime(messages: ChatMessage[]): ResponseTimeStats {
  const normalMessages = messages
    .filter((m) => m.type === 'message' && m.sender)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const responseGaps: number[] = [];

  for (let i = 0; i < normalMessages.length - 1; i++) {
    const current = normalMessages[i];
    const next = normalMessages[i + 1];

    if (current.sender && next.sender && current.sender !== next.sender) {
      const gapMs = next.timestamp.getTime() - current.timestamp.getTime();

      // Only count valid responses within 24h window
      if (gapMs >= 0 && gapMs <= MAX_RESPONSE_WINDOW_MS) {
        responseGaps.push(gapMs);
      }
    }
  }

  if (responseGaps.length === 0) {
    return {
      responseCount: 0,
      avgResponseTimeMs: 0,
      avgResponseTimeMinutes: 0,
      medianResponseTimeMs: 0,
      medianResponseTimeMinutes: 0,
      fastestMs: 0,
      slowestMs: 0,
    };
  }

  // Sort gaps ascending for median, fastest, slowest
  responseGaps.sort((a, b) => a - b);

  const sumMs = responseGaps.reduce((acc, val) => acc + val, 0);
  const avgResponseTimeMs = Math.round(sumMs / responseGaps.length);

  const mid = Math.floor(responseGaps.length / 2);
  const medianResponseTimeMs =
    responseGaps.length % 2 !== 0
      ? responseGaps[mid]
      : Math.round((responseGaps[mid - 1] + responseGaps[mid]) / 2);

  return {
    responseCount: responseGaps.length,
    avgResponseTimeMs,
    avgResponseTimeMinutes: Math.round(avgResponseTimeMs / 60000),
    medianResponseTimeMs,
    medianResponseTimeMinutes: Math.round(medianResponseTimeMs / 60000),
    fastestMs: responseGaps[0],
    slowestMs: responseGaps[responseGaps.length - 1],
  };
}
