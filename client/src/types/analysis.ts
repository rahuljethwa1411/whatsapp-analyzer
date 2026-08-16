import { ChatMetadata } from './chat';

export type ParticipantStats = {
  name: string;
  messageCount: number;
  percentage: number;
  firstMessageAt: Date | null;
  lastMessageAt: Date | null;
  mediaCount: number;
  emojiCount: number;
  wordCount: number;
  avgWordsPerMessage: number;
};

export type HourStats = {
  hour: number; // 0..23
  label: string; // e.g. "11 PM"
  messageCount: number;
};

export type DayStats = {
  dayIndex: number; // 0..6 (Sunday..Saturday)
  dayName: string; // e.g. "Monday"
  messageCount: number;
};

export type DailyStats = {
  dateStr: string; // YYYY-MM-DD
  date: Date;
  messageCount: number;
};

export type WeeklyStats = {
  weekKey: string; // YYYY-Www
  messageCount: number;
};

export type MonthlyStats = {
  monthKey: string; // YYYY-MM
  monthName: string; // e.g. "August 2024"
  messageCount: number;
};

export type YearlyStats = {
  year: number;
  messageCount: number;
};

export type PeakHour = {
  hour: number;
  label: string;
  messageCount: number;
};

export type PeakDay = {
  dayIndex: number;
  dayName: string;
  messageCount: number;
};

export type PeakMonth = {
  monthKey: string;
  monthName: string;
  messageCount: number;
};

export type SilenceGap = {
  startAt: Date;
  endAt: Date;
  durationMs: number;
  durationDays: number;
  startSender: string | null;
  endSender: string | null;
};

export type StreakInfo = {
  startDate: Date;
  endDate: Date;
  durationDays: number;
  totalActiveDays: number;
};

export type ResponseTimeStats = {
  responseCount: number;
  avgResponseTimeMs: number;
  avgResponseTimeMinutes: number;
  medianResponseTimeMs: number;
  medianResponseTimeMinutes: number;
  fastestMs: number;
  slowestMs: number;
};

export type EmojiFrequency = {
  emoji: string;
  count: number;
};

export type EmojiStats = {
  totalCount: number;
  uniqueCount: number;
  mostUsedEmoji: string | null;
  mostUsedCount: number;
  topEmojis: EmojiFrequency[];
  perParticipant: Record<string, EmojiFrequency[]>;
};

export type WordFrequency = {
  word: string;
  count: number;
};

export type WordStats = {
  totalWords: number;
  uniqueWords: number;
  topWords: WordFrequency[];
  perParticipant: Record<string, WordFrequency[]>;
};

export type ConversationSession = {
  id: string;
  startAt: Date;
  endAt: Date;
  messageCount: number;
  participants: string[];
  durationMs: number;
};

export type ActivityPeriod = {
  title: string;
  startDate: Date;
  endDate: Date;
  dateLabel: string;
  messageCount: number;
  description: string;
};

export type FactualHighlight = {
  type: string;
  title: string;
  description: string;
  statValue: string;
  metadata?: Record<string, any>;
};

export type ChatAnalysis = {
  metadata: ChatMetadata;
  participants: ParticipantStats[];
  activity: {
    byHour: HourStats[];
    byDayOfWeek: DayStats[];
    byDate: DailyStats[];
    byWeek: WeeklyStats[];
    byMonth: MonthlyStats[];
    byYear: YearlyStats[];
    peakHour: PeakHour | null;
    peakDay: PeakDay | null;
    peakMonth: PeakMonth | null;
    mostActiveYear: number | null;
    mostActiveParticipant: string | null;
    mostActiveDate: DailyStats | null;
    timeOfDayBuckets: {
      morning: { count: number; percentage: number }; // 06:00-11:59
      afternoon: { count: number; percentage: number }; // 12:00-16:59
      evening: { count: number; percentage: number }; // 17:00-21:59
      lateNight: { count: number; percentage: number }; // 22:00-05:59
    };
    weekendStats: {
      weekdayCount: number;
      weekendCount: number;
      weekdayPercentage: number;
      weekendPercentage: number;
    };
  };
  streaks: {
    longestActiveStreak: StreakInfo | null;
    longestSilence: SilenceGap | null;
  };
  responseTime: ResponseTimeStats;
  emojis: EmojiStats;
  words: WordStats;
  sessions: ConversationSession[];
  activityPeriods: ActivityPeriod[];
  highlights: FactualHighlight[];
};
