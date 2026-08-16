import { ChatMessage } from '../../types/chat';
import { ChatAnalysis, ActivityPeriod } from '../../types/analysis';
import { calculateMetadata } from './metadata';
import { calculateActivity } from './activity';
import { calculateParticipantStats } from './participants';
import { calculateStreaksAndSilence } from './streaks';
import { calculateResponseTime } from './responseTime';
import { calculateEmojiStats } from './emojis';
import { calculateWordStats } from './words';
import { calculateSessions } from './sessions';
import { calculateFactualHighlights } from './highlights';

export function analyzeChat(messages: ChatMessage[]): ChatAnalysis {
  // 1. Metadata
  const metadata = calculateMetadata(messages);

  // 2. Activity & Time Buckets
  const activity = calculateActivity(messages, metadata.participants);

  // 3. Participants
  const participants = calculateParticipantStats(messages, metadata.participants);

  // 4. Streaks & Silence
  const streaks = calculateStreaksAndSilence(messages);

  // 5. Response Time
  const responseTime = calculateResponseTime(messages);

  // 6. Emojis
  const emojis = calculateEmojiStats(messages, metadata.participants);

  // 7. Words
  const words = calculateWordStats(messages, metadata.participants);

  // 8. Sessions (2-hour threshold)
  const sessions = calculateSessions(messages);

  // 9. Activity Periods (Statistical eras / activity windows)
  const activityPeriods: ActivityPeriod[] = activity.byMonth.map((m, idx) => ({
    title: `PERIOD ${idx + 1}`,
    startDate: new Date(m.monthKey + '-01'),
    endDate: new Date(m.monthKey + '-28'),
    dateLabel: m.monthName,
    messageCount: m.messageCount,
    description: `${m.messageCount.toLocaleString()} messages exchanged in ${m.monthName}.`,
  }));

  // 10. Factual Highlights
  const highlights = calculateFactualHighlights(
    metadata,
    activity.peakHour,
    activity.peakDay,
    activity.peakMonth,
    streaks.longestSilence,
    streaks.longestActiveStreak,
    emojis
  );

  return {
    metadata,
    participants,
    activity,
    streaks,
    responseTime,
    emojis,
    words,
    sessions,
    activityPeriods,
    highlights,
  };
}
