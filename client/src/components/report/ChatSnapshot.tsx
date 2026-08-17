/**
 * ChatSnapshot Component
 * Editorial overview displaying Phase 2 factual stats in large typography.
 */

import { FadeReveal } from '../afterchat/FadeReveal';
import { ChatAnalysis } from '../../types/analysis';

interface ChatSnapshotProps {
  analysis: ChatAnalysis | null;
}

export function ChatSnapshot({ analysis }: ChatSnapshotProps) {
  const totalMsgs = analysis ? analysis.metadata.totalMessages.toLocaleString() : '24,821';
  const durationDays = analysis ? analysis.metadata.durationDays : 580;
  const peakHour = analysis?.activity.peakHour?.label || '11:47 PM';
  const peakDay = analysis?.activity.peakDay?.dayName || 'Saturday';
  const silenceDays = analysis?.streaks.longestSilence
    ? `${analysis.streaks.longestSilence.durationDays} DAYS`
    : '19 DAYS';
  const streakDays = analysis?.streaks.longestActiveStreak
    ? `${analysis.streaks.longestActiveStreak.durationDays} DAYS`
    : '42 DAYS';
  const topEmoji = analysis?.emojis.mostUsedEmoji || '💀';
  const mostActiveUser = analysis?.activity.mostActiveParticipant || 'Top Contributor';

  const snapshotStats = [
    { value: totalMsgs, label: 'MESSAGES ANALYZED', note: 'Normal text messages parsed locally' },
    { value: `${durationDays} DAYS`, label: 'TIMELINE SPAN', note: 'Total duration of conversation' },
    { value: peakHour, label: 'PEAK HOUR', note: 'Sleep was apparently optional' },
    { value: peakDay, label: 'BUSIEST DAY', note: 'Highest message volume day' },
    { value: silenceDays, label: 'LONGEST SILENCE', note: 'Longest gap between messages' },
    { value: streakDays, label: 'LONGEST STREAK', note: 'Consecutive active chat days' },
    { value: topEmoji, label: 'TOP EMOJI', note: 'Most frequently used reaction' },
    { value: mostActiveUser, label: 'TOP YAPPER', note: 'Highest overall message count' },
  ];

  return (
    <section id="sec-snapshot" className="report-snapshot-section">
      <FadeReveal>
        <p className="eyebrow">02 · CHAT SNAPSHOT</p>
        <h2>The evidence in numbers.</h2>
        <p className="lede">Before we dive into the lore, here is what the data says.</p>
      </FadeReveal>

      <div className="snapshot-typography-grid">
        {snapshotStats.map((stat, idx) => (
          <FadeReveal key={stat.label + idx}>
            <div className="snapshot-stat-card">
              <b className="snapshot-stat-val">{stat.value}</b>
              <span className="snapshot-stat-lbl">{stat.label}</span>
              <small className="snapshot-stat-note">{stat.note}</small>
            </div>
          </FadeReveal>
        ))}
      </div>
    </section>
  );
}
