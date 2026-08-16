import { ChatMessage } from '../../types/chat';
import { SilenceGap, StreakInfo } from '../../types/analysis';

export function calculateStreaksAndSilence(messages: ChatMessage[]): {
  longestSilence: SilenceGap | null;
  longestActiveStreak: StreakInfo | null;
} {
  const normalMessages = messages
    .filter((m) => m.type === 'message')
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (normalMessages.length < 2) {
    return {
      longestSilence: null,
      longestActiveStreak: null,
    };
  }

  // 1. Longest Silence Gap
  let maxSilenceMs = -1;
  let longestSilence: SilenceGap | null = null;

  for (let i = 0; i < normalMessages.length - 1; i++) {
    const current = normalMessages[i];
    const next = normalMessages[i + 1];
    const msDiff = next.timestamp.getTime() - current.timestamp.getTime();

    if (msDiff > maxSilenceMs) {
      maxSilenceMs = msDiff;
      const durationDays = Math.max(1, Math.round(msDiff / (1000 * 60 * 60 * 24)));
      longestSilence = {
        startAt: current.timestamp,
        endAt: next.timestamp,
        durationMs: msDiff,
        durationDays,
        startSender: current.sender,
        endSender: next.sender,
      };
    }
  }

  // 2. Active Daily Streaks
  const activeDateStrs = Array.from(
    new Set(normalMessages.map((m) => m.timestamp.toISOString().split('T')[0]))
  ).sort();

  let currentStreakStart = activeDateStrs[0];
  let currentStreakEnd = activeDateStrs[0];
  let currentStreakLength = 1;

  let maxStreakStart = activeDateStrs[0];
  let maxStreakEnd = activeDateStrs[0];
  let maxStreakLength = 1;

  for (let i = 1; i < activeDateStrs.length; i++) {
    const prevDate = new Date(activeDateStrs[i - 1]);
    const currDate = new Date(activeDateStrs[i]);

    // Check if consecutive calendar days (ms difference <= 36 hours for DST buffer)
    const dayDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDiff === 1) {
      currentStreakLength++;
      currentStreakEnd = activeDateStrs[i];
    } else {
      if (currentStreakLength > maxStreakLength) {
        maxStreakLength = currentStreakLength;
        maxStreakStart = currentStreakStart;
        maxStreakEnd = currentStreakEnd;
      }
      currentStreakLength = 1;
      currentStreakStart = activeDateStrs[i];
      currentStreakEnd = activeDateStrs[i];
    }
  }

  if (currentStreakLength > maxStreakLength) {
    maxStreakLength = currentStreakLength;
    maxStreakStart = currentStreakStart;
    maxStreakEnd = currentStreakEnd;
  }

  const longestActiveStreak: StreakInfo = {
    startDate: new Date(maxStreakStart),
    endDate: new Date(maxStreakEnd),
    durationDays: maxStreakLength,
    totalActiveDays: activeDateStrs.length,
  };

  return {
    longestSilence,
    longestActiveStreak,
  };
}
