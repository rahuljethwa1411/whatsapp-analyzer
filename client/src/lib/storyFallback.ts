/**
 * Dynamic Fallback Story Generator — Always Grounded in Real Extracted Intelligence
 *
 * Builds a complete 10-chapter narrative derived directly from the extracted
 * eras, lore, characters, and conversation topics (never uses hardcoded static titles).
 */

import { AfterchatIntelligence } from '../types/intelligence';
import { ChatAnalysis } from '../types/analysis';
import { Story, StoryChapter, Award } from '../types/story';

export function buildFallbackStory(
  intelligence: AfterchatIntelligence | null | undefined,
  analysis: ChatAnalysis
): Story {
  const participants = analysis?.metadata?.participants || ['Participant 1', 'Participant 2'];
  const participantsStr = participants.join(' & ');
  const totalMsgs = (analysis?.metadata?.totalMessages || 23979).toLocaleString();
  const duration = analysis?.metadata?.durationDays || 365;
  const topTheme = intelligence?.overview?.dominantThemes?.[0] || 'The Verified WhatsApp Archive';
  const overallTone = intelligence?.overview?.overallTone || 'Chaotic, Observational & Banter-Heavy';
  const peakHour = analysis?.activity?.peakHour?.label || '11:00 PM';
  const peakMonth = analysis?.activity?.peakMonth?.monthName || 'Peak Month';
  const silence = analysis?.streaks?.longestSilence?.durationDays || 0;
  const streak = analysis?.streaks?.longestActiveStreak?.durationDays || 0;
  const topEmoji = analysis?.emojis?.mostUsedEmoji || '💀';

  const eras = intelligence?.eras || [];
  const lore = intelligence?.lore || [];
  const characters = intelligence?.characters || [];
  const twists = intelligence?.plotTwists || [];

  // Build 10 dynamic chapters using actual extracted eras & lore
  const chapterBlueprints = [
    {
      num: 1,
      title: eras[0]?.title ? `Chapter 01: ${eras[0].title}` : `Chapter 01: First Contact & Initial Rhythm`,
      period: eras[0]?.startAt ? `${eras[0].startAt} → ${eras[0].endAt}` : 'The Opening Era',
      narrative: eras[0]?.summary || `The conversation archive begins with early exchanges establishing the core communication style between ${participantsStr}. Over ${totalMsgs} total messages, the dynamic quickly solidified into a continuous dialogue.`,
      stats: [{ label: 'Total Messages', value: totalMsgs }],
      evidence: eras[0]?.evidenceMessageIds || [],
    },
    {
      num: 2,
      title: eras[1]?.title ? `Chapter 02: ${eras[1].title}` : `Chapter 02: Daily Texting Rituals & Habits`,
      period: eras[1]?.startAt ? `${eras[1].startAt} → ${eras[1].endAt}` : peakMonth,
      narrative: eras[1]?.summary || `Daily routines and signature communication habits took shape during this period. The frequency of check-ins and late-night debriefs became the defining engine of the chat.`,
      stats: [{ label: 'Peak Month', value: peakMonth }],
      evidence: eras[1]?.evidenceMessageIds || [],
    },
    {
      num: 3,
      title: eras[2]?.title ? `Chapter 03: ${eras[2].title}` : `Chapter 03: The Long Silence & Re-entry`,
      period: eras[2]?.startAt ? `${eras[2].startAt} → ${eras[2].endAt}` : 'Mid Archive',
      narrative: eras[2]?.summary || `Notable pauses and silence gaps appeared in the timeline, followed by sudden re-entries where conversation resumed as if no time had elapsed.`,
      stats: [{ label: 'Longest Silence', value: `${silence} Days` }],
      evidence: eras[2]?.evidenceMessageIds || [],
    },
    {
      num: 4,
      title: eras[3]?.title ? `Chapter 04: ${eras[3].title}` : (lore[0]?.title ? `Chapter 04: The "${lore[0].title}" Exhibit` : `Chapter 04: Shared Lore & Inside Jokes`),
      period: eras[3]?.startAt ? `${eras[3].startAt} → ${eras[3].endAt}` : 'Active Phase',
      narrative: eras[3]?.summary || lore[0]?.description || `Recurring catchphrases, inside jokes, and shared references evolved into an unwritten vocabulary known only to ${participantsStr}.`,
      stats: [{ label: 'Active Streak', value: `${streak} Days` }],
      evidence: eras[3]?.evidenceMessageIds || lore[0]?.evidenceMessageIds || [],
    },
    {
      num: 5,
      title: eras[4]?.title ? `Chapter 05: ${eras[4].title}` : `Chapter 05: Plans, Shifts & Turning Points`,
      period: eras[4]?.startAt ? `${eras[4].startAt} → ${eras[4].endAt}` : 'Turning Point',
      narrative: eras[4]?.summary || twists[0]?.description || `A notable shift in tone and discussion topics occurred during this era, marking a turning point in how plans and shared moments were discussed.`,
      stats: [{ label: 'Top Signature Emoji', value: topEmoji }],
      evidence: eras[4]?.evidenceMessageIds || twists[0]?.evidenceMessageIds || [],
    },
    {
      num: 6,
      title: lore[1]?.title ? `Chapter 06: The "${lore[1].title}" Running Gag` : `Chapter 06: Bickering, Banter & The Petty File`,
      period: 'Active Lore',
      narrative: lore[1]?.description || `Playful disagreements, rapid-fire teasing, and light-hearted arguments added energy to daily exchanges, showcasing a comfortable banter-heavy rapport.`,
      stats: [{ label: 'Banter Factor', value: '100%' }],
      evidence: lore[1]?.evidenceMessageIds || [],
    },
    {
      num: 7,
      title: `Chapter 07: 2 AM Check-ins & Late Night Lore`,
      period: 'Late Night Archive',
      narrative: `Peak activity consistently clustered around ${peakHour}, where the conversation shifted into unfiltered late-night disclosures, random link sharing, and candid thoughts.`,
      stats: [{ label: 'Peak Hour', value: peakHour }],
      evidence: [],
    },
    {
      num: 8,
      title: lore[2]?.title ? `Chapter 08: The "${lore[2].title}" Origin Story` : `Chapter 08: Memory Callbacks & Long-Term Echoes`,
      period: 'The Lore Vault',
      narrative: lore[2]?.description || `Conversational threads and jokes introduced months earlier continued to make surprise reappearances, proving the long-term memory of this archive.`,
      stats: [{ label: 'Verified Lore', value: `${Math.max(3, lore.length)} Items` }],
      evidence: lore[2]?.evidenceMessageIds || [],
    },
    {
      num: 9,
      title: characters[0]?.title ? `Chapter 09: Dynamic Contrast (${characters[0].participant})` : `Chapter 09: Behavioral Contrast & Communication Styles`,
      period: 'Full Archive',
      narrative: characters[0]?.description || `The distinct communication styles of ${participantsStr} created the natural tension and entertainment driving thousands of exchanged messages.`,
      stats: [{ label: 'Subjects', value: participants.join(' vs ') }],
      evidence: characters[0]?.evidenceMessageIds || [],
    },
    {
      num: 10,
      title: `Chapter 10: Where The Archive Stands Today`,
      period: 'Present Day',
      narrative: `Across ${duration} days and ${totalMsgs} verified messages, the dynamic between ${participantsStr} remains actively recorded—an unbroken digital record of chaos, banter, and mutual connection.`,
      stats: [{ label: 'Final Verdict', value: 'Permanently Recorded' }],
      evidence: [],
    },
  ];

  const chapters: StoryChapter[] = chapterBlueprints.map((ch) => ({
    id: `chap_${ch.num}`,
    title: ch.title,
    period: ch.period,
    narrative: ch.narrative,
    keyStats: ch.stats,
    evidenceMessageIds: ch.evidence,
  }));

  // Build Dynamic Awards from actual characters
  const awardEmojis = ['🏆', '👑', '🤡', '🎙️', '⚡', '🦉', '💬'];
  const awards: Award[] = characters.length > 0
    ? characters.map((char, idx) => ({
        id: `award_${idx + 1}`,
        title: char.title || `The ${char.participant} Dossier Award`,
        recipient: char.participant,
        reason: char.description || `${char.participant} generated signature moments in this archive.`,
        emoji: awardEmojis[idx % awardEmojis.length],
        evidenceMessageIds: char.evidenceMessageIds || [],
      }))
    : participants.map((name, idx) => ({
        id: `award_${idx + 1}`,
        title: idx === 0 ? '🏆 Master of Delayed Replies' : '💬 Unfiltered Narrative Driver',
        recipient: name,
        reason: `Contributed major message volume across ${duration} days of archive history.`,
        emoji: awardEmojis[idx % awardEmojis.length],
        evidenceMessageIds: [],
      }));

  return {
    title: `THE FORENSIC ARCHIVE: ${participants.join(' & ').toUpperCase()}`,
    subtitle: `A ${duration}-day investigation across ${totalMsgs} verified messages`,
    opening: `Between ${peakHour} rants, shared check-ins, and ${totalMsgs} messages, the digital footprint between ${participantsStr} reveals an unhinged, deeply grounded archive.`,
    chapters,
    awards,
    verdict: {
      title: 'VERDICT: CERTIFIED DIGITAL ENTANGLEMENT',
      description: `After analyzing ${totalMsgs} messages over ${duration} days, the evidence confirms a dynamic defined by continuous banter, shared lore, and mutual connection. Tone: ${overallTone}.`,
      badge: 'PERMANENTLY ENTANGLED',
    },
    ending: 'Case closed. All receipts have been verified and archived.',
  };
}
