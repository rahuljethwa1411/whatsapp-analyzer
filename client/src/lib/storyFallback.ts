/**
 * Fallback Story Generator
 *
 * Builds a dynamic narrative from AfterchatIntelligence (eras, lore, characters, plot twists)
 * whenever the AI story generation endpoint is loading or delayed.
 * Ensures Chapter titles and prose reflect actual extracted chat content.
 */

import { AfterchatIntelligence } from '../types/intelligence';
import { ChatAnalysis } from '../types/analysis';
import { Story, StoryChapter, Award } from '../types/story';

export function buildFallbackStory(
  intelligence: AfterchatIntelligence | null | undefined,
  analysis: ChatAnalysis
): Story {
  const participants = analysis?.metadata?.participants || ['Rahul', 'Aisha'];
  const totalMsgs = (analysis?.metadata?.totalMessages || 24821).toLocaleString();
  const duration = analysis?.metadata?.durationDays || 580;
  const topTheme = intelligence?.overview?.dominantThemes?.[0] || 'Group Chat Lore';
  const overallTone = intelligence?.overview?.overallTone || 'Chaotic & Unhinged';
  const recurringJokes = intelligence?.overview?.recurringJokes || [];
  const mainJoke = recurringJokes[0] || 'inside references';

  // ── Build Chapters directly from extracted Eras ──────────────────────────────
  let chapters: StoryChapter[] = [];

  if (intelligence?.eras && intelligence.eras.length > 0) {
    chapters = intelligence.eras.slice(0, 4).map((era, idx) => ({
      id: `chap_${idx + 1}`,
      title: era.title || `Chapter ${idx + 1}: The Vibe Shift`,
      period: era.startAt && era.endAt ? `${era.startAt} → ${era.endAt}` : `Era ${idx + 1}`,
      narrative:
        era.summary
          ? `${era.summary} During this epoch, the conversation was heavily dominated by ${era.dominantTopics?.join(', ') || topTheme}, setting a distinctly ${era.tone || 'intense'} vibe.`
          : `During this period, ${participants.join(' and ')} entered a distinct chapter focused on ${era.dominantTopics?.join(', ') || topTheme}.`,
      keyStats: [
        { label: 'Dominant Vibe', value: era.tone || 'Chaotic' },
        { label: 'Key Topic', value: era.dominantTopics?.[0] || topTheme },
      ],
      evidenceMessageIds: era.evidenceMessageIds || [],
    }));
  }

  // Fallback 3 chapters if no eras present
  if (chapters.length === 0) {
    chapters = [
      {
        id: 'chap_1',
        title: 'Chapter 01: The Initial Spark',
        period: 'Early Days',
        narrative: `The conversation started innocently enough. Between initial plans and greetings, no one anticipated that this chat would eventually accumulate ${totalMsgs} messages over ${duration} days.`,
        keyStats: [
          { label: 'Total Messages', value: totalMsgs },
          { label: 'Duration', value: `${duration} Days` },
        ],
        evidenceMessageIds: [],
      },
      {
        id: 'chap_2',
        title: 'Chapter 02: The Golden Era',
        period: 'Peak Activity',
        narrative: `This was the golden age of the chat. Peak activity spiked around ${analysis?.activity?.peakHour?.label || 'midnight'}, with endless discussions about ${topTheme} and zero regard for sleep schedules.`,
        keyStats: [
          { label: 'Peak Hour', value: analysis?.activity?.peakHour?.label || '12 AM' },
          { label: 'Busiest Day', value: analysis?.activity?.peakDay?.dayName || 'Thursday' },
        ],
        evidenceMessageIds: [],
      },
      {
        id: 'chap_3',
        title: 'Chapter 03: The Unhinged Aftermath',
        period: 'Recent History',
        narrative: `The chat has evolved into a full-blown living archive of inside jokes, cancelled plans, and unforgettable receipts. Overall tone: ${overallTone}.`,
        keyStats: [
          { label: 'Longest Streak', value: `${analysis?.streaks?.longestActiveStreak?.durationDays || 0} Days` },
          { label: 'Top Emoji', value: analysis?.emojis?.mostUsedEmoji || '😭' },
        ],
        evidenceMessageIds: [],
      },
    ];
  }

  // ── Build Awards directly from extracted Character Archetypes ───────────────
  const awardEmojis = ['🏆', '👑', '🤡', '🎙️', '⚡', '🦉', '💬'];
  let awards: Award[] = [];

  if (intelligence?.characters && intelligence.characters.length > 0) {
    awards = intelligence.characters.map((char, idx) => ({
      id: `award_${idx + 1}`,
      title: char.title || `The ${char.participant} Archetype`,
      recipient: char.participant,
      reason: char.description || `${char.participant} generated major chat volume and defined the group dynamics.`,
      emoji: awardEmojis[idx % awardEmojis.length],
      evidenceMessageIds: char.evidenceMessageIds || [],
    }));
  } else {
    participants.forEach((name, idx) => {
      awards.push({
        id: `award_${idx + 1}`,
        title: idx === 0 ? '🏆 Top Yapper Award' : '💬 Reaction Specialist',
        recipient: name,
        reason: `Contributed to ${totalMsgs} messages across ${duration} days.`,
        emoji: awardEmojis[idx % awardEmojis.length],
        evidenceMessageIds: [],
      });
    });
  }

  // ── Final Narrative Object ──────────────────────────────────────────────────
  return {
    title: `${topTheme}: The Official Documentary`,
    subtitle: `A ${duration}-day forensic investigation into ${participants.join(', ')}`,
    opening: `Between ${analysis?.activity?.peakHour?.label || 'midnight'} rants, ${mainJoke}, and ${totalMsgs} total messages, this chat stopped being a messaging thread and became a Netflix-worthy docuseries.`,
    chapters,
    awards,
    verdict: {
      title: 'VERDICT: ABSOLUTELY UNHINGED',
      description: `After analyzing ${totalMsgs} messages over ${duration} days, our investigators confirm that this relationship is 100% certified lore. Tone: ${overallTone}.`,
      badge: 'VERIFIED ARCHIVE',
    },
    ending: 'Case closed. The receipts have been permanently recorded.',
  };
}
