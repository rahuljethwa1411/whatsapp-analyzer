/**
 * Complete Story Generation Prompt.
 *
 * Turns verified extracted evidence into a specific 10-chapter story.
 * The narrator may be funny and sharp, but the facts must come from receipts.
 */

export function buildStorySystemPrompt() {
  return `You are the story narrator for AfterChat.

Your job is to write THE LORE: a 10-chapter documentary-style story that feels like someone actually read the chat, remembered the ridiculous details, noticed the patterns, and understood what changed.

ABSOLUTE TRUTH RULE:
- Use only the supplied verified evidence, receipts, patterns, callbacks, contradictions, lore, eras, and statistics.
- Do not invent dates, events, quotes, feelings, relationship labels, callbacks, contradictions, or statistics.
- You may be creative in HOW you tell the story. You may not be creative about WHAT happened.
- If evidence is thin, create different evidence-backed angles from what exists instead of fabricating events.

CONVERSATION-TYPE RULE:
- Do not assume romance, dating, attraction, intimacy, commitment, love, or a relationship.
- Infer the conversation type from evidence: friendship, romantic, family, coworkers, classmates, group chat, hostile, casual, mixed, ambiguous, or something else.
- Use romantic language only if the evidence directly supports it.
- For serious/conflict-heavy chats, be observant and respectful. For funny/chaotic chats, roast playfully when receipts support it.
- Never diagnose people. Describe observable behavior.

BEFORE WRITING, INTERNALLY PLAN 10 DISTINCT CHAPTER ANGLES:
- Each chapter must have a different reason to exist.
- Do not write 10 chronological summaries.
- Do not repeat the same interpretation with new wording.
- Ask before finalizing each chapter: "What does this chapter reveal that the previous chapter did not?"
- If the answer is basically the same, choose a new angle.

SUPPORTED ANGLES CAN INCLUDE:
first contact, first impression, becoming comfortable, funniest era, roast era, inside joke, recurring phrase, recurring behavior, exes, dating, crushes, jealousy, flirting, mixed signals, rejection, vulnerability, argument, conflict, apology, reconciliation, silence, comeback after silence, misunderstanding, plot twist, confession, chaotic behavior, contradiction, character development, friendship lore, group-chat lore, memorable event, plans, trips, shared interests, callback, recurring argument, funniest misunderstanding, emotional turning point, personality contrast, who is actually the problem, current dynamic, unresolved threads.

These are examples, not mandatory. Select only angles supported by evidence.

STYLE:
- Gen-Z, conversational, witty, sharp, self-aware, and specific.
- Entertaining before analytical.
- Use playful lines like "At this point, the chat had officially become a competitive sport" only when the evidence supports that kind of chaos.
- Avoid academic, corporate, therapy-note, Wikipedia, or generic AI prose.

BANNED GENERIC FILLER:
- "As the conversation progressed..."
- "Over time, their relationship evolved..."
- "Their bond grew stronger..."
- "The conversation took a dramatic turn..."
- "They navigated the complexities of their relationship..."
- "They began to understand each other better..."
Do not use these unless followed immediately by specific evidence, and prefer not using them at all.

CHAPTER REQUIREMENTS:
- Return exactly 10 chapters.
- Each chapter needs a specific memorable title.
- Each chapter needs a clear period/date range label, even for thematic chapters.
- Each chapter narrative should be 2-5 paragraphs.
- Every paragraph should contain something specific to this conversation.
- Each chapter should cite 1-4 real message IDs from the verified receipt catalog when available.
- Use statistics only when relevant. Do not repeat the same global stat in every chapter.
- Chapter 10 must reflect the latest supported state, unresolved thread, or what the dynamic became. Do not force a happy or romantic ending.

OUTPUT:
- Return valid JSON matching StorySchema.
- Do not add fields outside the schema.
- Do not include markdown or prose outside JSON.`;
}

export function buildStoryUserPrompt({
  intelligence,
  summaryStats,
  metadata,
  formattedReceipts,
  storyAngles,
}) {
  const inv = intelligence._investigatorResult || {};
  const participants = metadata.participants.join(', ');

  const erasSummary = (intelligence.eras || [])
    .map((e, idx) =>
      `Era ${idx + 1}: "${e.title}" (${e.startAt || e.startDate || 'Start'} to ${e.endAt || e.endDate || 'End'}) - ${e.summary}`
    )
    .join('\n');

  const patternsSummary = (inv.patterns || [])
    .map(p => `- Pattern: "${p.pattern}" - ${p.explanation}`)
    .join('\n');

  const contradictionsSummary = (inv.contradictions || [])
    .map(c => `- Contradiction: "${c.claim}" vs "${c.laterBehavior}" - ${c.explanation}`)
    .join('\n');

  const callbacksSummary = (inv.callbacks || [])
    .map(cb => `- Callback: earlier [${cb.earlier?.messageId}] to later [${cb.later?.messageId}] - ${cb.connection}`)
    .join('\n');

  const turningPointsSummary = (inv.turningPoints || [])
    .map(tp => `- Turning point: "${tp.title}" - ${tp.description}`)
    .join('\n');

  const loreSummary = (inv.lore || [])
    .map(l => `- Lore: "${l.name}" - ${l.origin} / ${l.howItEvolved}`)
    .join('\n');

  const evidenceStoreSummary = (intelligence._evidenceStore || [])
    .slice(0, 80)
    .map(ev => `- [${ev.messageId}] ${ev.timestamp || ''} ${ev.sender || 'Unknown'} (${ev.type || 'receipt'}, ${ev.importance ?? ''}): "${ev.text || ''}" | ${ev.connection || ''}`)
    .join('\n');

  const anglePlan = (storyAngles || [])
    .map((angle, idx) =>
      `Chapter ${idx + 1}: ${angle.label} | period: ${angle.period} | receipts: ${angle.evidenceMessageIds.join(', ') || 'none'} | why: ${angle.reason}`
    )
    .join('\n');

  return `CONVERSATION DOSSIER
Participants: ${participants}
Total messages: ${metadata.totalMessages.toLocaleString()}
Duration: ${metadata.durationDays} days
Chat type hint/context: ${metadata.chatType || 'not specified'}
${metadata.backstory ? `Backstory/context: ${metadata.backstory}\n` : ''}

GROUND TRUTH STATISTICS:
- Peak hour: ${summaryStats.peakHour || 'unknown'}
- Peak day: ${summaryStats.peakDay || 'unknown'}
- Peak month: ${summaryStats.peakMonth || 'unknown'}
- Longest silence: ${summaryStats.longestSilenceDays ?? 'unknown'} days
- Longest active streak: ${summaryStats.longestStreakDays ?? 'unknown'} days
- Top emoji: ${summaryStats.mostUsedEmoji || 'none'}
- Top words: ${(summaryStats.topWords || []).slice(0, 10).join(', ') || 'none'}

DISCOVERED ERAS:
${erasSummary || 'No eras available.'}

PATTERNS:
${patternsSummary || 'None verified.'}

CONTRADICTIONS:
${contradictionsSummary || 'None verified.'}

CALLBACKS:
${callbacksSummary || 'None verified.'}

TURNING POINTS:
${turningPointsSummary || 'None verified.'}

LORE:
${loreSummary || 'None verified.'}

RECOMMENDED 10-CHAPTER ANGLE PLAN:
${anglePlan}

VERIFIED EVIDENCE STORE:
${evidenceStoreSummary || 'No evidence store available.'}

${formattedReceipts ? `VERIFIED RECEIPT CATALOG:\n${formattedReceipts}\n` : ''}

WRITE THE STORY NOW.

MANDATORY JSON SHAPE:
{
  "title": "Specific title based on the evidence",
  "subtitle": "Specific one-sentence subtitle",
  "opening": "A sharp 2-3 paragraph opening grounded in the dossier.",
  "chapters": [
    {
      "id": "chap_1",
      "title": "Specific memorable chapter title",
      "period": "Date/date range or thematic period",
      "narrative": "2-5 paragraphs of specific evidence-grounded storytelling.",
      "keyStats": [{ "label": "Relevant stat label", "value": "Known stat value" }],
      "evidenceMessageIds": ["real_message_id"]
    }
  ],
  "awards": [
    {
      "id": "award_1",
      "title": "Witty award title",
      "recipient": "Participant name or group",
      "reason": "Specific reason grounded in evidence.",
      "emoji": "trophy",
      "evidenceMessageIds": ["real_message_id"]
    }
  ],
  "verdict": {
    "title": "SPECIFIC FINAL VERDICT",
    "description": "2-3 sentences grounded in verified evidence.",
    "badge": "Specific badge"
  },
  "ending": "A final line that fits the evidence."
}

QUALITY CHECK BEFORE RETURNING:
- Exactly 10 chapters.
- 10 distinct angles.
- No generic filler.
- No unsupported romance.
- No invented facts.
- No invented statistics.
- No invented callbacks.
- Every evidenceMessageIds value must be from the verified receipts/evidence above.
- Return only valid JSON.`;
}
