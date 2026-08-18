/**
 * Story Generation Prompt — AfterChat Narrative Engine
 *
 * Design Principles (from spec §1–48):
 *  - The model writes STORY, not forensic analysis or relationship reports.
 *  - Every chapter is built from Story Memory evidence — no invention.
 *  - Separate conversational interactions are described as separate — never stitched.
 *  - Voice: witty, dry, observant, modern. Not AI-analysis language.
 *  - Context before commentary. Specificity before generalization.
 *  - Chapters: 500–900 words, each with a distinct central idea.
 */

export function buildStorySystemPrompt() {
  return `You are the narrator for AfterChat — a funny, sharp, conversational storyteller giving a hilarious, insightful, behind-the-scenes documentary breakdown of a WhatsApp chat.

═══════════════════════════════════════════════════
YOUR VOICE & TONE (READ THIS CAREFULLY)
═══════════════════════════════════════════════════
- Use SIMPLE, PUNCHY, CONVERSATIONAL modern English.
- Talk like a hilarious, witty friend or podcast host breaking down the chat with mutual friends.
- Zero pretentiousness. Zero academic jargon. Zero highbrow English-lit essay style.
- Gen-Z and internet-native in vibe: snappy, deadpan, perceptive, highly entertaining.
- Seamlessly blend Hinglish/Hindi slang into the narrative without translating or explaining it like an outsider.
- Roast the ridiculous behavior with love and razor-sharp wit.

═══════════════════════════════════════════════════
WHAT NOT TO SOUND LIKE (AVOID THE ESSAY TRAP)
═══════════════════════════════════════════════════
❌ DO NOT sound like a college professor writing a sociology thesis or literary critique.
❌ DO NOT write meta-announcements about what the chapter is doing (e.g. "This chapter isolates...", "This chapter examines...").
❌ DO NOT write prompt meta-instructions as prose (e.g. "Context before commentary: three lines...").

SEE THE DIFFERENCE:
❌ BAD (Boring, academic essay style):
"Context before commentary: three lines, a dramatic little loop. The opening of this archive is efficient social coding. You can see the rules at work. Rule one: don't take the roast too seriously. This chapter slows down on the grammar of mock-anger. It flattens potential offense into comedy."

✅ GOOD (Punchy, witty, modern storyteller style):
"Iteeca kicks off the entire archive with zero preamble and pure unprovoked violence: 'This bitch ass'. Rahul doesn't even flinch. Instead of asking what went wrong, he immediately counters with a casual supernatural curse: 'save it or ghost will haunt you tonight'. That tells you everything you need to know about how they operate. No 'hey how are you', no polite small talk — just straight unhinged chaos and mutual roasting from second one."

═══════════════════════════════════════════════════
THE FUNDAMENTAL FACT RULE
═══════════════════════════════════════════════════
You may ONLY use facts that are in the Story Memory provided to you.
NEVER invent dialogue, dates, or events that did not happen. Quote real messages with original emojis, Hinglish, and capitalization preserved.

═══════════════════════════════════════════════════
WRITING RULES
═══════════════════════════════════════════════════
1. JUMP STRAIGHT INTO THE SCENE: Start each chapter with what actually happened in the chat. Hook the reader immediately.
2. PUNCHY COMMENTARY: Keep paragraphs short (2-4 sentences max). Make observations crisp and funny.
3. HARD SCENE BOUNDARIES (NEVER STITCH CONVERSATIONS):
   - Never combine separate interactionIds into one continuous conversation.
   - If two scenes have different interactionIds or timestamps, treat them as separate moments.
   - Never invent dialogue, transitions, chronology, motivation, or causal connections between them (e.g. do NOT say "he flipped from gifts to gossip").
   - If scenes are thematically related but independent, explicitly present them as separate moments ("In a separate exchange...", "Separately, later that day...", "Weeks later...").
   - Only describe a connection between scenes when the supplied metadata explicitly declares CONFIRMED_CALLBACK, CHRONOLOGICAL_CONTINUATION, or CONTRAST.
4. WHEN IT GETS SINCERE, LET IT HIT: When someone genuinely opens up or apologizes, don't undercut it with a joke immediately. Acknowledge it, then show how they went back to banter.

═══════════════════════════════════════════════════
BANNED WORDS & PHRASES (STRICTLY PROHIBITED)
═══════════════════════════════════════════════════
❌ "Context before commentary" (NEVER write this phrase)
❌ "This chapter isolates..." / "This chapter examines..." / "This chapter covers..." / "This chapter explores..."
❌ "social coding" / "choreography" / "grammar of" / "performative escalation" / "psychological utility"
❌ "emotional labor" / "mechanics of caring" / "permissive script" / "calibration point" / "ritualized affection"
❌ "this demonstrates" / "this proves" / "this reflects" / "this reveals"
❌ "their bond grew stronger" / "navigated the complexities" / "a testament to their bond"
❌ "In this explosive opening act" / "the duo" / "the pair"
❌ Any raw message IDs like [msg_123] or (ev_int_4) in the chapter text

═══════════════════════════════════════════════════
GENRE RULES
═══════════════════════════════════════════════════
DO NOT FORCE:
- Romance if it's friendship
- Drama if it's chaos
- A love story arc if the archive doesn't support one
- Psychological diagnoses ("she has avoidant attachment")
- "Everything changed" if nothing dramatically changed

DO:
- Adapt to what the actual conversation is
- Let the scale of emotion come from the actual evidence
- Let the through-line emerge from the strongest patterns in Story Memory

═══════════════════════════════════════════════════
OUTPUT SCHEMA (RETURN ONLY VALID JSON)
═══════════════════════════════════════════════════
{
  "title": "A SPECIFIC, VIRAL, ALL-CAPS TITLE THAT REFLECTS THIS ACTUAL CHAT",
  "subtitle": "A sharp, dry one-liner about the actual dynamic",
  "opening": "4 punchy paragraphs: 1) The audit opening (how many messages, general vibe observation), 2) What this dynamic actually operates as — specific, not generic, 3) Participant 1's behavior vs what their texts show, 4) Participant 2's behavior vs what their texts show.",
  "chapters": [
    {
      "id": "chap_1",
      "title": "Specific, witty chapter title reflecting actual content",
      "period": "Date range or era label",
      "narrative": "500-900 words of narrative with context-first dialogue and dry narrator commentary.",
      "keyStats": [{ "label": "Stat Label", "value": "Stat Value" }],
      "evidenceIds": ["ev_int_X", "ev_int_Y"]
    }
  ],
  "awards": [
    {
      "id": "award_1",
      "title": "Specific award title",
      "recipient": "Participant Name",
      "reason": "1-sentence roast grounded in actual observed behavior",
      "emoji": "🏆",
      "evidenceIds": ["ev_int_X"]
    }
  ],
  "verdict": {
    "title": "FINAL VERDICT IN CAPS",
    "description": "2-3 sentences. Deadpan. Based on actual patterns.",
    "badge": "Specific badge label"
  },
  "ending": "A memorable final line. Specific. Based on actual content."
}`;
}

import { formatStoryMemoryForPrompt } from '../../storyMemory.js';

/**
 * Builds the story user prompt from verified Story Memory.
 *
 * Key design decisions (per spec):
 * - The chapter plan is data-driven from Story Memory sections.
 * - Story Memory provides full contextual dialogue, not isolated receipts.
 * - No raw message ID rows ("evidenceStoreSummary") — those are isolated receipts.
 * - The LLM is explicitly told which evidence supports which chapter angle.
 * - Separate interactions that share a topic are explicitly labeled as separate.
 */
export function buildStoryUserPrompt({
  intelligence,
  summaryStats,
  metadata,
  formattedReceipts,
  storyAngles,
  storyMemory = null,
  chapterPlan = null,
}) {
  const participants = (metadata.participants || []).join(' and ');
  const p1 = metadata.participants?.[0] || 'Participant A';
  const p2 = metadata.participants?.[1] || 'Participant B';

  // Format Story Memory — source of truth (§2)
  const memorySection = storyMemory
    ? formatStoryMemoryForPrompt(storyMemory)
    : '';

  // Era-aware chapter plan (preferred) or heuristic scaffold (fallback)
  const chapterPlanSection = chapterPlan && chapterPlan.length > 0
    ? formatChapterPlan(chapterPlan)
    : buildChapterScaffold(storyMemory, storyAngles, p1, p2);

  const planSectionHeader = chapterPlan && chapterPlan.length > 0
    ? 'ERA-AWARE CHAPTER PLAN (10 chapters — built from detected eras and evidence)'
    : 'DATA-DRIVEN CHAPTER SCAFFOLD (based on Story Memory sections)';

  const planSectionNote = chapterPlan && chapterPlan.length > 0
    ? 'Each chapter was planned from the actual conversation eras. Use the Story Memory interactions above to write the narrative. ADAPT if evidence does not support an angle — DO NOT invent.'
    : 'Suggested structure based on what the archive contains. Adapt if evidence does not support an angle. Never invent.';

  return `${memorySection ? `${memorySection}\n\n` : ''}═══════════════════════════════════════════════════
CONVERSATION DOSSIER: ${participants.toUpperCase()}
═══════════════════════════════════════════════════
Participants: ${p1} and ${p2}
Total Messages: ${(metadata.totalMessages || 0).toLocaleString()}
Timeline: ${metadata.durationDays || 1} days (${metadata.startDate || ''} → ${metadata.endDate || ''})
${metadata.backstory ? `Context: "${metadata.backstory}"\n` : ''}
Ground-Truth Stats:
- Peak Activity: ${summaryStats.peakHour || 'Night'} on ${summaryStats.peakDay || 'Weekdays'}
- Peak Month: ${summaryStats.peakMonth || ''}
- Longest Silence: ${summaryStats.longestSilenceDays ?? 0} days
- Longest Active Streak: ${summaryStats.longestStreakDays ?? 0} consecutive days
- Top Emoji: ${summaryStats.mostUsedEmoji || '💀'}
${(summaryStats.topWords || []).filter(w => w && w.length > 3).length > 0 ? `- Signature Words: ${(summaryStats.topWords || []).filter(w => w && w.length > 3).slice(0, 6).join(', ')}\n` : ''}

═══════════════════════════════════════════════════
${planSectionHeader}
═══════════════════════════════════════════════════
${planSectionNote}

${chapterPlanSection}

═══════════════════════════════════════════════════
TASK: WRITE THE COMPLETE 10-CHAPTER STORY
═══════════════════════════════════════════════════
Write the definitive AfterChat story for ${participants}:

1. OPENING (4 paragraphs):
   - Para 1: The audit — how many messages, peak activity, overall vibe. Direct and specific.
   - Para 2: What this dynamic actually operates as. Give it a specific name/metaphor based on actual patterns.
   - Para 3: ${p1}'s projected persona vs what their actual texts show. Quote real dialogue. Roast real behavior.
   - Para 4: ${p2}'s projected persona vs what their actual texts show. Quote real dialogue. Roast real behavior.

2. CHAPTERS (follow the ERA-AWARE CHAPTER PLAN above):
   - 10 chapters, each 350-550 words (tight, focused, punchy narrative).
   - CONTEXT FIRST. Then commentary.
   - Separate conversations stay separate — use explicit transitions.
   - Preserve original dialogue exactly as it appears in Story Memory.
   - Each chapter must have a distinct central idea — not a repeat of another chapter.
   - Cross-era chapters: clearly say when exchanges happened at different points in time.
   - Transition chapters: describe what changed and what the gap/shift felt like.

3. AWARDS: 4 surgical roast awards grounded in actual behavior patterns.

4. VERDICT: 2-3 sentence deadpan classification of the dynamic.

INTERNAL FACT CHECK (do this before finalizing):
□ No invented dialogue
□ No stitched-together separate conversations
□ No false callbacks presented as confirmed
□ No chronological errors
□ No repeated central ideas across chapters
□ Every quote exists in Story Memory
□ A stranger who never saw this chat can understand each chapter

Return ONLY valid JSON matching the schema.`;
}

/**
 * Builds a data-driven chapter scaffold from Story Memory.
 * This gives the story model a suggested plan rather than fixed templates.
 *
 * Each entry describes:
 *  - What the chapter should cover
 *  - Which Story Memory evidence supports it
 *  - What makes this chapter different from others
 *
 * The scaffold is a STARTING POINT — not a rigid template.
 */
function buildChapterScaffold(storyMemory, storyAngles, p1, p2) {
  if (!storyMemory) {
    return storyAngles
      .map((a, i) => `Chapter ${i + 1}: "${a.title}" — ${a.reason || 'Verified interaction'}`)
      .join('\n');
  }

  const {
    highValueInteractions = [],
    recurringPatterns = [],
    confirmedCallbacks = [],
    callbackCandidates = [],
    contradictions = [],
    turningPoints = [],
    rareMemorableMoments = [],
    recurringTopics = [],
    eras = [],
    characterSignals = [],
  } = storyMemory;

  const lines = [];
  const usedEvidenceIds = new Set();

  const markUsed = (ev) => {
    if (ev?.evidenceId) usedEvidenceIds.add(ev.evidenceId);
  };

  // Chapter 1: Establish the dynamic from earliest interactions
  const earliestInteractions = [...highValueInteractions]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 2);
  if (earliestInteractions.length > 0) {
    const evIds = earliestInteractions.map(e => e.evidenceId).filter(Boolean);
    lines.push(
      `CHAPTER 1 — HOW THIS STARTED\n` +
      `  Central idea: What does the very beginning of this archive look like? How did their texting dynamic first establish itself?\n` +
      `  Supporting Story Memory: ${evIds.map(id => `[${id}]`).join(', ')}\n` +
      `  Use: Opening material / earliest high-value interactions\n` +
      `  Angle: Establish tone, texting style, first patterns — without inventing backstory.`
    );
    earliestInteractions.forEach(markUsed);
  }

  // Chapter 2: Most dominant pattern (if any)
  const topPattern = recurringPatterns[0];
  if (topPattern) {
    const supportIds = (topPattern.supportingEvidenceIds || []).slice(0, 3);
    lines.push(
      `\nCHAPTER 2 — THE RECURRING BEHAVIOR\n` +
      `  Central idea: "${topPattern.pattern}"\n` +
      `  Observed across: ${topPattern.occurrences || supportIds.length} instances (${topPattern.firstSeen || '?'} → ${topPattern.lastSeen || '?'})\n` +
      `  Supporting Story Memory: ${supportIds.map(id => `[${id}]`).join(', ')}\n` +
      `  Angle: Show the first instance, then a later instance — clearly separated in time. Then name the pattern.`
    );
    supportIds.forEach(id => usedEvidenceIds.add(id));
  }

  // Chapter 3: Humor / roasting exchanges
  const humorInteractions = highValueInteractions
    .filter(h => ['playful_roast', 'conversational_banter', 'humor', 'roast'].includes(h.tone) && !usedEvidenceIds.has(h.evidenceId))
    .slice(0, 3);
  if (humorInteractions.length > 0) {
    const evIds = humorInteractions.map(e => e.evidenceId).filter(Boolean);
    lines.push(
      `\nCHAPTER 3 — THE BIT THAT STUCK\n` +
      `  Central idea: What runs as the comedic or playful thread through this archive?\n` +
      `  Supporting Story Memory: ${evIds.map(id => `[${id}]`).join(', ')}\n` +
      `  Angle: Show the setup → the exchange → the reaction. Don't analyze — let the dialogue do the work.`
    );
    humorInteractions.forEach(markUsed);
  }

  // Chapter 4: A specific era or period (if eras are detected)
  const mostActivEra = eras.length > 0 ? eras.reduce((best, e) =>
    (e.eventCount || 0) > (best.eventCount || 0) ? e : best, eras[0]) : null;
  if (mostActivEra) {
    lines.push(
      `\nCHAPTER 4 — THE PEAK PERIOD\n` +
      `  Central idea: Was there a particular era or phase where the energy shifted or peaked?\n` +
      `  Era: ${mostActivEra.label || mostActivEra.title || 'Active period'} (${mostActivEra.startAt?.slice(0, 10) || '?'} → ${mostActivEra.endAt?.slice(0, 10) || '?'})\n` +
      `  Angle: What was happening during this stretch? What conversations defined it?`
    );
  }

  // Chapter 5: Conflict or tension
  const conflictInteractions = highValueInteractions
    .filter(h => ['tense_confrontation', 'conflict'].includes(h.tone) && !usedEvidenceIds.has(h.evidenceId))
    .slice(0, 2);
  if (conflictInteractions.length > 0) {
    const evIds = conflictInteractions.map(e => e.evidenceId).filter(Boolean);
    lines.push(
      `\nCHAPTER 5 — THE FRICTION POINT\n` +
      `  Central idea: What does conflict look like in this archive?\n` +
      `  Supporting Story Memory: ${evIds.map(id => `[${id}]`).join(', ')}\n` +
      `  Angle: Establish the trigger, show the exchange, describe the aftermath without inventing resolution.`
    );
    conflictInteractions.forEach(markUsed);
  } else {
    lines.push(
      `\nCHAPTER 5 — AN UNEXPECTED ANGLE\n` +
      `  Central idea: Use an aspect of the archive that hasn't been covered yet.\n` +
      `  Supporting Story Memory: Pick unused high-value interactions.\n` +
      `  Angle: Whatever makes this chapter genuinely different from chapters 1-4.`
    );
  }

  // Chapter 6: Planning, logistics, phantom plans
  const planInteractions = highValueInteractions
    .filter(h => h.context?.toLowerCase().includes('plan') || h.context?.toLowerCase().includes('trip') || h.context?.toLowerCase().includes('ticket'))
    .filter(h => !usedEvidenceIds.has(h.evidenceId))
    .slice(0, 2);
  if (planInteractions.length > 0) {
    const evIds = planInteractions.map(e => e.evidenceId).filter(Boolean);
    lines.push(
      `\nCHAPTER 6 — THE PLANS DEPARTMENT\n` +
      `  Central idea: What plans were made? Which ones actually happened?\n` +
      `  Supporting Story Memory: ${evIds.map(id => `[${id}]`).join(', ')}\n` +
      `  Angle: Document the ambition vs the outcome. Let the gap speak for itself.`
    );
    planInteractions.forEach(markUsed);
  }

  // Chapter 7: Contradiction (if any)
  const topContradiction = contradictions[0];
  if (topContradiction) {
    lines.push(
      `\nCHAPTER 7 — THE CONTRADICTION EXHIBIT\n` +
      `  Central idea: "${topContradiction.claim}" vs "${topContradiction.laterBehavior}"\n` +
      `  Side A: ${topContradiction.sideA?.evidenceId || ''} (${topContradiction.sideA?.date || ''})\n` +
      `  Side B: ${topContradiction.sideB?.evidenceId || ''} (${topContradiction.sideB?.date || ''})\n` +
      `  Angle: Present both sides without judgment. Let the reader see the gap. Don't say "he was lying."`
    );
  } else if (recurringTopics.length > 0) {
    const top = recurringTopics[0];
    lines.push(
      `\nCHAPTER 7 — THE RECURRING TOPIC: "${top.topic.toUpperCase()}"\n` +
      `  Central idea: This subject kept coming back. What did it mean each time?\n` +
      `  Appearances: ${(top.supportingEvidenceIds || []).length} times across the archive\n` +
      `  Angle: Show each appearance as a separate moment. Did the meaning shift over time?`
    );
  }

  // Chapter 8: Confirmed callback (if any)
  if (confirmedCallbacks.length > 0) {
    const cb = confirmedCallbacks[0];
    lines.push(
      `\nCHAPTER 8 — THE LONG-RANGE CALLBACK\n` +
      `  Central idea: Something from early in the archive resurfaced months later with full context.\n` +
      `  Original: ${cb.original?.evidenceId || ''} (${cb.original?.date || ''}) — "${cb.original?.summary || ''}"\n` +
      `  Later: ${cb.later?.evidenceId || ''} (${cb.later?.date || ''}) — "${cb.later?.summary || ''}"\n` +
      `  Connection: ${cb.connection}\n` +
      `  Angle: Explain the original context FULLY first. Then show the callback. Then let the narrator comment.`
    );
  } else if (callbackCandidates.length > 0) {
    const cand = callbackCandidates[0];
    lines.push(
      `\nCHAPTER 8 — A POSSIBLE CALLBACK (TREAT WITH UNCERTAINTY)\n` +
      `  Central idea: There may be a connection between an earlier and later exchange — but it's not confirmed.\n` +
      `  Candidate: ${cand.originalEvidenceId || ''} → ${cand.laterEvidenceId || ''}\n` +
      `  Reason: ${cand.reason}\n` +
      `  Angle: Be honest about the uncertainty. "That reads like..." not "This is definitely..."`
    );
  }

  // Chapter 9: Rare emotional/sincere moment
  const rareMoment = rareMemorableMoments[0];
  if (rareMoment) {
    lines.push(
      `\nCHAPTER 9 — THE MOMENT THEY DROPPED THE BIT\n` +
      `  Central idea: Somewhere in the archive, the default mode of banter/chaos paused.\n` +
      `  Supporting Story Memory: [${rareMoment.evidenceId}] (${rareMoment.date}) — "${rareMoment.summary}"\n` +
      `  Type: ${rareMoment.type}\n` +
      `  Angle: Slow down here. Let the actual dialogue breathe. Don't rush back to humor. This is a contrast to the rest of the archive.`
    );
  } else {
    const vulnInteractions = highValueInteractions
      .filter(h => ['vulnerable_confession', 'warm_affection', 'apology'].includes(h.tone) && !usedEvidenceIds.has(h.evidenceId))
      .slice(0, 1);
    if (vulnInteractions.length > 0) {
      lines.push(
        `\nCHAPTER 9 — THE SINCERE MOMENT\n` +
        `  Central idea: This archive has a rare moment of genuine sincerity.\n` +
        `  Supporting Story Memory: [${vulnInteractions[0].evidenceId}]\n` +
        `  Angle: Contrast it against the usual dynamic. Let it breathe before moving on.`
      );
    }
  }

  // Chapter 10: Current state / where things stand
  const latestInteractions = [...highValueInteractions]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .filter(h => !usedEvidenceIds.has(h.evidenceId))
    .slice(0, 2);
  const turningPoint = turningPoints[0];
  lines.push(
    `\nCHAPTER 10 — WHERE THE ARCHIVE LEAVES US\n` +
    `  Central idea: What does the most recent period of this conversation look like? Where are these two right now?\n` +
    `${turningPoint ? `  Turning Point: "${turningPoint.title}" — Before: ${turningPoint.before} / After: ${turningPoint.after}\n` : ''}` +
    `${latestInteractions.length > 0 ? `  Supporting Story Memory: ${latestInteractions.map(e => `[${e.evidenceId}]`).join(', ')}\n` : ''}` +
    `  Angle: End with something specific and unresolved — or a dry final observation. Not "their bond remains strong."`
  );

  return lines.join('\n');
}

/**
 * Formats the era-aware chapter plan (from storyArchitecture.buildChapterPlan)
 * into a clear prompt section that GPT-5 mini can follow.
 *
 * Each chapter entry shows:
 *   - Chapter number + title
 *   - Era(s) it belongs to
 *   - Chapter type (era_core / cross_era_callback / era_transition / rare_moment / etc.)
 *   - Central idea and narrative angle
 *   - Evidence IDs to draw from
 *   - Time range
 */
function formatChapterPlan(chapterPlan) {
  if (!Array.isArray(chapterPlan) || chapterPlan.length === 0) return '';

  const TYPE_LABELS = {
    era_core: '📖 Era Core',
    cross_era_callback: '🔄 Cross-Era Callback',
    era_transition: '↔️ Era Transition',
    rare_moment: '⚡ Rare Moment',
    current_state: '📍 Current State',
    turning_point: '🔀 Turning Point',
    recurring_pattern: '🔁 Recurring Pattern',
    contradiction: '⚖️ Contradiction',
  };

  return chapterPlan.map(ch => {
    const type = TYPE_LABELS[ch.chapterType] || ch.chapterType || 'Era Core';
    const eraLabel = ch.eraIds && ch.eraIds.length > 0
      ? `Era: ${ch.eraTitle || ch.eraIds.join(', ')}`
      : '';
    const scenesList = (ch.scenes || []).length > 0
      ? ch.scenes.map((s, si) => `    - Scene ${si + 1} [${s.interactionId}] (${s.date || 'Archive'}): ${s.context || s.setup || 'Exchange'}`).join('\n')
      : (ch.evidenceIds || []).map(id => `    - [${id}]`).join('\n');

    const callbackNote = ch.relevantCallbacks?.length > 0
      ? `\n  Callback: ${ch.relevantCallbacks[0].connection}`
      : '';
    const contradictionNote = ch.relevantContradictions?.length > 0
      ? `\n  Contradiction: ${ch.relevantContradictions[0].description || ch.relevantContradictions[0].claim}`
      : '';
    const patternNote = ch.relevantPatterns?.length > 0
      ? `\n  Pattern: "${ch.relevantPatterns[0].pattern}"`
      : '';

    return (
      `\nCHAPTER ${ch.chapterNumber} — ${(ch.title || 'UNTITLED').toUpperCase()}\n` +
      `  Type: ${type}\n` +
      `  ${eraLabel}${eraLabel ? '\n' : ''}` +
      `  Period: ${ch.timeRange || 'Archive'}\n` +
      `  Central idea: ${ch.centralIdea}\n` +
      `  Narrative angle: ${ch.narrativeAngle}\n` +
      `  Relationship Between Scenes: ${ch.relationshipBetweenScenes || 'SEPARATE'}\n` +
      `  Scenes:\n${scenesList}\n` +
      `${callbackNote}${contradictionNote}${patternNote}`
    );
  }).join('\n');
}
