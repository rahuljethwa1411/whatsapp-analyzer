import { ChatMessage } from '../../types/chat';
import {
  HourStats,
  DayStats,
  DailyStats,
  WeeklyStats,
  MonthlyStats,
  YearlyStats,
  PeakHour,
  PeakDay,
  PeakMonth,
} from '../../types/analysis';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function calculateActivity(messages: ChatMessage[], participants: string[]) {
  const normalMessages = messages.filter((m) => m.type === 'message');

  // By Hour (0..23)
  const hourCounts = new Array(24).fill(0);
  // By Day of Week (0..6)
  const dayOfWeekCounts = new Array(7).fill(0);
  // By Date (YYYY-MM-DD)
  const dateMap = new Map<string, { date: Date; count: number }>();
  // By Month (YYYY-MM)
  const monthMap = new Map<string, { name: string; count: number }>();
  // By Year
  const yearMap = new Map<number, number>();
  // Sender count
  const senderMap = new Map<string, number>();

  let morningCount = 0;   // 06:00 - 11:59
  let afternoonCount = 0; // 12:00 - 16:59
  let eveningCount = 0;   // 17:00 - 21:59
  let lateNightCount = 0; // 22:00 - 05:59

  let weekdayCount = 0; // Mon-Fri
  let weekendCount = 0; // Sat-Sun

  normalMessages.forEach((m) => {
    const ts = m.timestamp;
    const h = ts.getHours();
    const day = ts.getDay();
    const y = ts.getFullYear();
    const mo = ts.getMonth();

    hourCounts[h]++;
    dayOfWeekCounts[day]++;

    // Sender count
    if (m.sender) {
      senderMap.set(m.sender, (senderMap.get(m.sender) || 0) + 1);
    }

    // Time of Day buckets
    if (h >= 6 && h < 12) morningCount++;
    else if (h >= 12 && h < 17) afternoonCount++;
    else if (h >= 17 && h < 22) eveningCount++;
    else lateNightCount++;

    // Weekday vs Weekend (0 = Sun, 6 = Sat)
    if (day === 0 || day === 6) weekendCount++;
    else weekdayCount++;

    // Date YYYY-MM-DD
    const dateStr = ts.toISOString().split('T')[0];
    const existingDate = dateMap.get(dateStr);
    if (existingDate) {
      existingDate.count++;
    } else {
      dateMap.set(dateStr, { date: ts, count: 1 });
    }

    // Month YYYY-MM
    const monthKey = `${y}-${String(mo + 1).padStart(2, '0')}`;
    const monthLabel = `${MONTH_NAMES[mo]} ${y}`;
    const existingMonth = monthMap.get(monthKey);
    if (existingMonth) {
      existingMonth.count++;
    } else {
      monthMap.set(monthKey, { name: monthLabel, count: 1 });
    }

    // Year
    yearMap.set(y, (yearMap.get(y) || 0) + 1);
  });

  const total = normalMessages.length || 1;

  // Format Hour Stats
  const byHour: HourStats[] = hourCounts.map((count, hour) => ({
    hour,
    label: formatHourLabel(hour),
    messageCount: count,
  }));

  // Format Day of Week Stats
  const byDayOfWeek: DayStats[] = dayOfWeekCounts.map((count, dayIndex) => ({
    dayIndex,
    dayName: DAY_NAMES[dayIndex],
    messageCount: count,
  }));

  // Format Daily Stats
  const byDate: DailyStats[] = Array.from(dateMap.entries()).map(([dateStr, d]) => ({
    dateStr,
    date: d.date,
    messageCount: d.count,
  }));

  // Format Monthly Stats
  const byMonth: MonthlyStats[] = Array.from(monthMap.entries()).map(([monthKey, m]) => ({
    monthKey,
    monthName: m.name,
    messageCount: m.count,
  }));

  // Format Yearly Stats
  const byYear: YearlyStats[] = Array.from(yearMap.entries()).map(([year, messageCount]) => ({
    year,
    messageCount,
  }));

  // Calculate Peak Hour
  let peakHour: PeakHour | null = null;
  let maxHourVal = -1;
  byHour.forEach((h) => {
    if (h.messageCount > maxHourVal) {
      maxHourVal = h.messageCount;
      peakHour = { hour: h.hour, label: h.label, messageCount: h.messageCount };
    }
  });

  // Calculate Peak Day
  let peakDay: PeakDay | null = null;
  let maxDayVal = -1;
  byDayOfWeek.forEach((d) => {
    if (d.messageCount > maxDayVal) {
      maxDayVal = d.messageCount;
      peakDay = { dayIndex: d.dayIndex, dayName: d.dayName, messageCount: d.messageCount };
    }
  });

  // Calculate Peak Month
  let peakMonth: PeakMonth | null = null;
  let maxMonthVal = -1;
  byMonth.forEach((m) => {
    if (m.messageCount > maxMonthVal) {
      maxMonthVal = m.messageCount;
      peakMonth = { monthKey: m.monthKey, monthName: m.monthName, messageCount: m.messageCount };
    }
  });

  // Most Active Date
  let mostActiveDate: DailyStats | null = null;
  let maxDateVal = -1;
  byDate.forEach((d) => {
    if (d.messageCount > maxDateVal) {
      maxDateVal = d.messageCount;
      mostActiveDate = d;
    }
  });

  // Most Active Participant
  let mostActiveParticipant: string | null = null;
  let maxSenderVal = -1;
  senderMap.forEach((count, sender) => {
    if (count > maxSenderVal) {
      maxSenderVal = count;
      mostActiveParticipant = sender;
    }
  });

  // Most Active Year
  let mostActiveYear: number | null = null;
  let maxYearVal = -1;
  byYear.forEach((y) => {
    if (y.messageCount > maxYearVal) {
      maxYearVal = y.messageCount;
      mostActiveYear = y.year;
    }
  });

  return {
    byHour,
    byDayOfWeek,
    byDate,
    byWeek: [], // extensible for weekly
    byMonth,
    byYear,
    peakHour,
    peakDay,
    peakMonth,
    mostActiveYear,
    mostActiveParticipant,
    mostActiveDate,
    timeOfDayBuckets: {
      morning: { count: morningCount, percentage: Math.round((morningCount / total) * 100) },
      afternoon: { count: afternoonCount, percentage: Math.round((afternoonCount / total) * 100) },
      evening: { count: eveningCount, percentage: Math.round((eveningCount / total) * 100) },
      lateNight: { count: lateNightCount, percentage: Math.round((lateNightCount / total) * 100) },
    },
    weekendStats: {
      weekdayCount,
      weekendCount,
      weekdayPercentage: Math.round((weekdayCount / total) * 100),
      weekendPercentage: Math.round((weekendCount / total) * 100),
    },
  };
}
