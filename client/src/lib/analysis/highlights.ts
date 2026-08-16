import { ChatMetadata } from '../../types/chat';
import {
  PeakHour,
  PeakDay,
  PeakMonth,
  SilenceGap,
  StreakInfo,
  EmojiStats,
  FactualHighlight,
} from '../../types/analysis';

export function calculateFactualHighlights(
  metadata: ChatMetadata,
  peakHour: PeakHour | null,
  peakDay: PeakDay | null,
  peakMonth: PeakMonth | null,
  longestSilence: SilenceGap | null,
  longestStreak: StreakInfo | null,
  emojis: EmojiStats
): FactualHighlight[] {
  const highlights: FactualHighlight[] = [];

  if (peakHour) {
    highlights.push({
      type: 'peak_hour',
      title: 'Peak Activity Hour',
      description: `The conversation peaks at ${peakHour.label}.`,
      statValue: peakHour.label,
      metadata: { hour: peakHour.hour, messageCount: peakHour.messageCount },
    });
  }

  if (peakDay) {
    highlights.push({
      type: 'peak_day',
      title: 'Busiest Day of the Week',
      description: `${peakDay.dayName} sees the highest message volume.`,
      statValue: peakDay.dayName,
      metadata: { dayIndex: peakDay.dayIndex, messageCount: peakDay.messageCount },
    });
  }

  if (peakMonth) {
    highlights.push({
      type: 'peak_month',
      title: 'Most Active Month',
      description: `Peak month: ${peakMonth.monthName}.`,
      statValue: peakMonth.monthName,
      metadata: { monthKey: peakMonth.monthKey, messageCount: peakMonth.messageCount },
    });
  }

  if (longestSilence) {
    highlights.push({
      type: 'longest_silence',
      title: 'Longest Silence',
      description: `The longest gap between messages lasted ${longestSilence.durationDays} days.`,
      statValue: `${longestSilence.durationDays} days`,
      metadata: { durationDays: longestSilence.durationDays, startAt: longestSilence.startAt, endAt: longestSilence.endAt },
    });
  }

  if (longestStreak) {
    highlights.push({
      type: 'longest_streak',
      title: 'Longest Daily Streak',
      description: `Messages were exchanged for ${longestStreak.durationDays} consecutive days.`,
      statValue: `${longestStreak.durationDays} days`,
      metadata: { durationDays: longestStreak.durationDays },
    });
  }

  if (emojis.mostUsedEmoji) {
    highlights.push({
      type: 'most_used_emoji',
      title: 'Top Emoji',
      description: `The most used emoji is ${emojis.mostUsedEmoji} (${emojis.mostUsedCount} times).`,
      statValue: emojis.mostUsedEmoji,
      metadata: { emoji: emojis.mostUsedEmoji, count: emojis.mostUsedCount },
    });
  }

  return highlights;
}
