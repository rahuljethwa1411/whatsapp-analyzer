/**
 * Complete Story Generator Engine
 *
 * Pipeline:
 *  1. Story Memory construction (from verified intelligence + conversation memory)
 *  2. Era Detection (already embedded in Story Memory via eraDetector)
 *  3. Era-Aware Chapter Planning (buildChapterPlan from storyArchitecture)
 *  4. GPT story model call with full chapter plan + Story Memory
 *  5. Chapter enforcement (exactly 10, evidence-grounded gap fill)
 *  6. Evidence ID normalization (evidenceIds / evidenceMessageIds alias)
 *  7. Story polish (strip raw IDs from text, strip filler language)
 */

import { getOpenAIService, DailyLimitError, InvalidApiKeyError } from './ai/openaiClient.js';
import { getModelForTier } from './ai/modelConfig.js';
import { StorySchema, STORY_JSON_SCHEMA } from './ai/schemas/index.js';
import { buildStorySystemPrompt, buildStoryUserPrompt } from './ai/prompts/storyPrompt.js';
import { huntAndVerifyReceipts } from './receiptHunter.js';
import { buildStoryMemory } from './storyMemory.js';
import { buildChapterPlan } from './storyArchitecture.js';
import { getCachedStory, setCachedStory } from './ai/chunkCache.js';
import { STORY_MAX_OUTPUT_TOKENS } from './tokenEstimator.js';

// ── Filler patterns to strip from narratives ──────────────────────────────────
const GENERIC_FILLER_PATTERNS = [
  /as the conversation progressed/gi,
  /over time, their relationship evolved/gi,
  /their bond (continued to grow|grew stronger)/gi,
  /the conversation took a dramatic turn/gi,
  /navigated the complexities of their relationship/gi,
  /began to understand each other better/gi,
  /this demonstrates their/gi,
  /this reveals their/gi,
  /this reflects their/gi,
  /evolved with distinctive energy and conversational pacing/gi,
  /captures their characteristic texting habits, spontaneous banter, and shared timeline moments/gi,
  /^context before commentary:?\s*/gim,
  /this chapter (isolates|examines|slows down on the grammar of)\s*/gi,
  /logistics masquerading as affection/gi,
  /feelings (are )?expressed as chores/gi,
  /roast economy/gi,
  /cultural economy/gi,
  /emotional labor/gi,
  /currency of jokes/gi,
  /minted out of/gi,
  /social capital/gi,
  /transactional affection/gi,
];

/**
 * Generate the Complete 10-Chapter Story using the OpenAI Story Model.
 *
 * @param {Object} params
 * @param {Object} params.intelligence - AfterchatIntelligence
 * @param {Object} params.summaryStats - ChatSummaryStats
 * @param {Object} params.metadata - ChatMetadata
 * @param {Map} [params.messageIndex] - Optional MessageIndex for cross-verification
 * @returns {Promise<{ story: Object, receipts: Array }>}
 */
export async function generateCompleteStory({
  intelligence,
  summaryStats,
  metadata,
  messageIndex = null,
}) {
  const storyModel = getModelForTier('story');

  const cached = getCachedStory(intelligence, metadata, storyModel);
  if (cached) {
    console.log('[Story] ✓ Cache hit for story');
    return cached;
  }

  // Build receipt catalog for backward-compat (used by chapter enforcement fallback)
  const receiptCatalog = huntAndVerifyReceipts(intelligence, messageIndex, 30);

  // ── Step 1: Build verified Story Memory (includes era detection) ──────────
  const storyMemory = buildStoryMemory({
    evidenceStore: intelligence._evidenceStore || [],
    conversationMemory: intelligence._conversationMemory || {},
    metadata,
    summaryStats,
  });

  // ── Step 2: Era-Aware Chapter Planning ───────────────────────────────────
  const { chapters: chapterPlan, telemetry: planTelemetry } = buildChapterPlan(storyMemory);

  // ── Step 3: Data-driven angle list (fallback for enforcement) ────────────
  const storyAngles = buildStoryAnglesFromMemory(storyMemory, metadata, summaryStats);

  console.log(
    `[Story] Generating story for ${metadata.participants.join(', ')} | ` +
    `Model: ${storyModel} | ` +
    `${(storyMemory.highValueInteractions || []).length} HV interactions | ` +
    `${(storyMemory.eras || []).length} eras | ` +
    `${chapterPlan.length} planned chapters | ` +
    `${(storyMemory.confirmedCallbacks || []).length} callbacks | ` +
    `${planTelemetry.crossEraChapters} cross-era`
  );

  const openaiService = getOpenAIService();
  let rawStory = null;

  try {
    rawStory = await openaiService.completeStructured({
      model: storyModel,
      tier: 'story',
      systemPrompt: buildStorySystemPrompt(),
      userPrompt: buildStoryUserPrompt({
        intelligence,
        summaryStats,
        metadata,
        formattedReceipts: null,
        storyAngles,
        storyMemory,
        chapterPlan,
      }),
      schema: STORY_JSON_SCHEMA,
      schemaName: 'CompleteStoryResponse',
      maxOutputTokens: STORY_MAX_OUTPUT_TOKENS,
      temperature: 0.82,
    });
  } catch (err) {
    if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;
    console.warn('[Story] Initial story generation pass failed:', err.message);

    try {
      console.log('[Story] Attempting repair pass...');
      rawStory = await openaiService.completeStructured({
        model: storyModel,
        tier: 'story',
        systemPrompt:
          buildStorySystemPrompt() +
          '\n\nIMPORTANT: Output MUST be strictly valid JSON matching StorySchema with EXACTLY 10 distinct narrative chapters (500-900 words each). Do not use generic filler. Every chapter must reference actual Story Memory evidence.',
        userPrompt: buildStoryUserPrompt({
          intelligence,
          summaryStats,
          metadata,
          formattedReceipts: null,
          storyAngles,
          storyMemory,
          chapterPlan,
        }),
        schema: STORY_JSON_SCHEMA,
        schemaName: 'CompleteStoryResponse',
        maxOutputTokens: STORY_MAX_OUTPUT_TOKENS,
        temperature: 0.75,
      });
      console.log('[Story] Repair pass succeeded.');
    } catch (repairErr) {
      if (repairErr instanceof DailyLimitError || repairErr instanceof InvalidApiKeyError) throw repairErr;
      console.warn('[Story] Repair pass failed, building evidence-grounded baseline story.');
      rawStory = buildBaselineStory(storyMemory, metadata, summaryStats, storyAngles);
    }
  }

  // Enforce exactly 10 chapters with evidence-grounded fallbacks
  const normalizedStory = enforceTenChapters(rawStory, storyMemory, storyAngles);

  // Normalize evidenceIds / evidenceMessageIds fields (accept both from model output)
  normalizeEvidenceIds(normalizedStory);

  // Strip raw message IDs from text, strip filler language
  polishStory(normalizedStory);

  console.log(
    `[Story] Story generated: "${normalizedStory.title}" (${normalizedStory.chapters.length} chapters).`
  );

  const finalResult = {
    story: normalizedStory,
    receipts: receiptCatalog.receipts,
  };

  setCachedStory(intelligence, metadata, storyModel, finalResult);
  return finalResult;
}

// ── § Evidence ID Normalization ───────────────────────────────────────────────

/**
 * The model may return evidenceIds (new schema) or evidenceMessageIds (legacy).
 * Normalize: merge both into evidenceMessageIds for downstream compatibility,
 * and ensure evidenceIds is always present.
 */
function normalizeEvidenceIds(story) {
  for (const chapter of story.chapters || []) {
    const primary = Array.isArray(chapter.evidenceIds) ? chapter.evidenceIds : [];
    const legacy  = Array.isArray(chapter.evidenceMessageIds) ? chapter.evidenceMessageIds : [];
    const merged  = Array.from(new Set([...primary, ...legacy]));
    chapter.evidenceIds = merged;
    chapter.evidenceMessageIds = merged;  // keep for backward-compat with UI
  }
  for (const award of story.awards || []) {
    const primary = Array.isArray(award.evidenceIds) ? award.evidenceIds : [];
    const legacy  = Array.isArray(award.evidenceMessageIds) ? award.evidenceMessageIds : [];
    const merged  = Array.from(new Set([...primary, ...legacy]));
    award.evidenceIds = merged;
    award.evidenceMessageIds = merged;
  }
}

// ── § Chapter Enforcement ─────────────────────────────────────────────────────

/**
 * Ensures story.chapters has EXACTLY 10 items.
 * Uses Story Memory evidence for any gap-filling — never generic filler.
 */
export function enforceTenChapters(story, storyMemory, storyAngles = []) {
  const result = { ...story };
  let chapters = Array.isArray(result.chapters) ? [...result.chapters] : [];

  // Fill gaps with evidence-grounded stubs
  while (chapters.length < 10) {
    const index = chapters.length;
    const angle = storyAngles[index];
    const fallback = angle
      ? chapterFromAngle(angle, index, storyMemory)
      : chapterFromMemorySlot(index, storyMemory);
    chapters.push(fallback);
  }

  // Merge excess chapters into last
  while (chapters.length > 10) {
    const last = chapters.pop();
    const prev = chapters[chapters.length - 1];
    if (prev && last) {
      prev.narrative = [prev.narrative, last.narrative].filter(Boolean).join('\n\n');
      const combined = [...(prev.evidenceIds || []), ...(last.evidenceIds || [])];
      prev.evidenceIds = Array.from(new Set(combined)).slice(0, 6);
      prev.evidenceMessageIds = prev.evidenceIds;
    }
  }

  result.chapters = chapters.map((chapter, index) => {
    const angle = storyAngles[index];
    const evIds = Array.from(new Set([
      ...(chapter.evidenceIds || []),
      ...(chapter.evidenceMessageIds || []),
    ]));

    return {
      ...chapter,
      id: `chap_${index + 1}`,
      title: chapter.title || angle?.title || `Chapter ${index + 1}`,
      period: chapter.period || angle?.period || '',
      narrative: chapter.narrative || (angle ? buildNarrativeFromAngle(angle, storyMemory) : ''),
      keyStats: Array.isArray(chapter.keyStats) ? chapter.keyStats : [],
      evidenceIds: evIds,
      evidenceMessageIds: evIds,
    };
  });

  return result;
}

/**
 * Creates an evidence-grounded chapter stub from a story angle.
 */
function chapterFromAngle(angle, index, storyMemory) {
  return {
    id: `chap_${index + 1}`,
    title: angle.title,
    period: angle.period || '',
    narrative: buildNarrativeFromAngle(angle, storyMemory),
    keyStats: angle.keyStats || [],
    evidenceIds: angle.evidenceIds || [],
    evidenceMessageIds: angle.evidenceIds || [],
  };
}

/**
 * Creates a minimal evidence-grounded chapter stub from a memory slot.
 * Does NOT use generic filler prose.
 */
function chapterFromMemorySlot(index, storyMemory) {
  const interactions = storyMemory?.highValueInteractions || [];
  const ev = interactions[index % Math.max(1, interactions.length)];

  const narrative = ev
    ? `This chapter covers a ${ev.tone || 'conversational'} exchange from ${ev.date || 'the archive'}.\n\n` +
      `Context: ${ev.context || 'Conversational interaction'}\n\n` +
      (ev.dialogue || []).map(d => `> ${d}`).join('\n')
    : 'This section of the archive has been reserved for additional context.';

  return {
    id: `chap_${index + 1}`,
    title: ev ? `${ev.context?.slice(0, 60) || 'Archive Moment'}` : `Chapter ${index + 1}`,
    period: ev?.date || '',
    narrative,
    keyStats: [],
    evidenceIds: ev ? [ev.evidenceId].filter(Boolean) : [],
    evidenceMessageIds: ev ? [ev.evidenceId].filter(Boolean) : [],
  };
}

/**
 * Builds a readable narrative from a story angle using Story Memory dialogue.
 * Used only when the model fails to produce a chapter.
 */
function buildNarrativeFromAngle(angle, storyMemory) {
  const interactions = storyMemory?.highValueInteractions || [];
  const relevantEvs = (angle.evidenceIds || [])
    .map(id => interactions.find(h => h.evidenceId === id))
    .filter(Boolean);

  if (relevantEvs.length === 0) {
    const fallbackEv = interactions[0];
    if (!fallbackEv) return angle.reason || 'This chapter covers a documented interaction.';
    return (
      `During ${fallbackEv.date || 'this period'}, the archive records a ${fallbackEv.tone || 'conversational'} exchange.\n\n` +
      `Context: ${fallbackEv.context || ''}\n\n` +
      (fallbackEv.dialogue || []).map(d => `> ${d}`).join('\n')
    );
  }

  return relevantEvs.map(ev =>
    `On ${ev.date || 'this occasion'} — a ${ev.tone || 'conversational'} exchange — ` +
    `${ev.context || ''}.\n\n` +
    (ev.dialogue || []).slice(0, 4).map(d => `> ${d}`).join('\n')
  ).join('\n\n');
}

// ── § Story Angles from Story Memory ─────────────────────────────────────────

/**
 * Builds a data-driven set of story angles from Story Memory sections.
 * These are used as fallback seeds for chapter enforcement — not rigid templates.
 *
 * Each angle references actual Story Memory evidence IDs, not isolated message rows.
 */
export function buildStoryAnglesFromMemory(storyMemory, metadata, summaryStats) {
  if (!storyMemory) return [];

  const angles = [];
  const used = new Set();

  const {
    highValueInteractions = [],
    recurringPatterns = [],
    confirmedCallbacks = [],
    contradictions = [],
    turningPoints = [],
    rareMemorableMoments = [],
    eras = [],
  } = storyMemory;

  const addAngle = (angle) => {
    (angle.evidenceIds || []).forEach(id => used.add(id));
    angles.push(angle);
  };

  // Angle 1: Earliest interactions (dynamic establishment)
  const early = [...highValueInteractions]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .filter(h => !used.has(h.evidenceId))
    .slice(0, 2);
  if (early.length > 0) {
    addAngle({
      title: 'How This Archive Opens',
      period: early[0]?.date || '',
      reason: 'Earliest documented interactions establishing the dynamic',
      evidenceIds: early.map(e => e.evidenceId).filter(Boolean),
      keyStats: buildKeyStats(metadata, summaryStats),
    });
  }

  // Angle 2: Top recurring pattern
  const topPattern = recurringPatterns[0];
  if (topPattern) {
    addAngle({
      title: `The Recurring Behavior: ${topPattern.pattern?.slice(0, 50) || 'Documented Pattern'}`,
      period: `${topPattern.firstSeen || ''} → ${topPattern.lastSeen || ''}`,
      reason: topPattern.pattern,
      evidenceIds: (topPattern.supportingEvidenceIds || []).slice(0, 3),
      keyStats: buildKeyStats(metadata, summaryStats),
    });
  }

  // Angle 3: Humor / roasting exchanges
  const humor = highValueInteractions
    .filter(h => ['playful_roast', 'humor', 'roast', 'conversational_banter'].includes(h.tone) && !used.has(h.evidenceId))
    .slice(0, 3);
  if (humor.length > 0) {
    addAngle({
      title: 'The Bit That Stuck',
      period: humor[0]?.date || '',
      reason: 'High-value humor / roasting exchanges from the archive',
      evidenceIds: humor.map(e => e.evidenceId).filter(Boolean),
      keyStats: buildKeyStats(metadata, summaryStats),
    });
  }

  // Angle 4: Most active era
  if (eras.length > 0) {
    const best = eras.reduce((b, e) => (e.eventCount || 0) > (b.eventCount || 0) ? e : b, eras[0]);
    addAngle({
      title: best.label || best.title || 'The Peak Period',
      period: `${best.startAt?.slice(0, 10) || ''} → ${best.endAt?.slice(0, 10) || ''}`,
      reason: best.summary || 'Most active era in the archive',
      evidenceIds: [],
      keyStats: buildKeyStats(metadata, summaryStats),
    });
  }

  // Angle 5: Conflict / tension
  const conflict = highValueInteractions
    .filter(h => ['tense_confrontation', 'conflict'].includes(h.tone) && !used.has(h.evidenceId))
    .slice(0, 2);
  if (conflict.length > 0) {
    addAngle({
      title: 'The Friction Point',
      period: conflict[0]?.date || '',
      reason: 'Tension / conflict exchanges',
      evidenceIds: conflict.map(e => e.evidenceId).filter(Boolean),
      keyStats: buildKeyStats(metadata, summaryStats),
    });
  }

  // Angle 6: Planning / logistics
  const plans = highValueInteractions
    .filter(h => h.context?.toLowerCase().includes('plan') || h.tone === 'logistical_banter')
    .filter(h => !used.has(h.evidenceId))
    .slice(0, 2);
  if (plans.length > 0) {
    addAngle({
      title: 'The Plans Department',
      period: plans[0]?.date || '',
      reason: 'Planning and logistics interactions',
      evidenceIds: plans.map(e => e.evidenceId).filter(Boolean),
      keyStats: buildKeyStats(metadata, summaryStats),
    });
  }

  // Angle 7: Contradiction
  if (contradictions.length > 0) {
    const c = contradictions[0];
    addAngle({
      title: 'Exhibit A vs Exhibit B',
      period: `${c.sideA?.date || ''} → ${c.sideB?.date || ''}`,
      reason: `Contradiction: "${c.claim}" vs "${c.laterBehavior}"`,
      evidenceIds: [c.sideA?.evidenceId, c.sideB?.evidenceId].filter(Boolean),
      keyStats: buildKeyStats(metadata, summaryStats),
    });
  }

  // Angle 8: Confirmed callback
  if (confirmedCallbacks.length > 0) {
    const cb = confirmedCallbacks[0];
    addAngle({
      title: 'The Long-Range Callback',
      period: `${cb.original?.date || ''} → ${cb.later?.date || ''}`,
      reason: cb.connection,
      evidenceIds: [cb.original?.evidenceId, cb.later?.evidenceId].filter(Boolean),
      keyStats: buildKeyStats(metadata, summaryStats),
    });
  }

  // Angle 9: Rare sincere moment
  if (rareMemorableMoments.length > 0) {
    const rare = rareMemorableMoments[0];
    addAngle({
      title: 'The Moment They Dropped The Bit',
      period: rare.date || '',
      reason: rare.summary || `Rare ${rare.type} moment`,
      evidenceIds: [rare.evidenceId].filter(Boolean),
      keyStats: buildKeyStats(metadata, summaryStats),
    });
  }

  // Angle 10: Latest / current state
  const latest = [...highValueInteractions]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .filter(h => !used.has(h.evidenceId))
    .slice(0, 2);
  addAngle({
    title: 'Where The Archive Leaves Us',
    period: latest[0]?.date || 'Most recent',
    reason: 'Latest documented interactions — current state of the dynamic',
    evidenceIds: latest.map(e => e.evidenceId).filter(Boolean),
    keyStats: buildKeyStats(metadata, summaryStats),
  });

  // Fill any remaining slots with unused high-value interactions
  for (const hv of highValueInteractions) {
    if (angles.length >= 10) break;
    if (!used.has(hv.evidenceId)) {
      addAngle({
        title: hv.context?.slice(0, 60) || 'Archive Interaction',
        period: hv.date || '',
        reason: hv.context || 'High-value interaction',
        evidenceIds: [hv.evidenceId].filter(Boolean),
        keyStats: buildKeyStats(metadata, summaryStats),
      });
    }
  }

  return angles.slice(0, 10).map((angle, index) => ({
    ...angle,
    chapterNumber: index + 1,
  }));
}

// Keep old export name for any remaining callers
export function buildStoryAngles(intelligence, metadata, summaryStats, receiptCatalog) {
  return buildStoryAnglesFromMemory(null, metadata, summaryStats);
}

function buildKeyStats(metadata = {}, summaryStats = {}) {
  const stats = [];
  if (summaryStats?.peakHour) stats.push({ label: 'Peak Hour', value: summaryStats.peakHour });
  if (summaryStats?.longestStreakDays) stats.push({ label: 'Streak', value: `${summaryStats.longestStreakDays} days` });
  if (metadata?.totalMessages) stats.push({ label: 'Messages', value: `${metadata.totalMessages.toLocaleString()}` });
  return stats.slice(0, 2);
}

// ── § Story Polish ─────────────────────────────────────────────────────────────

function polishStory(story) {
  if (!story.title) story.title = 'The WhatsApp Chronicles';
  if (!story.subtitle) story.subtitle = 'An archive-grounded story';

  function stripMsgIds(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\[\s*msg_\d+\s*\]/gi, '')
      .replace(/\(\s*msg_\d+\s*\)/gi, '')
      .replace(/\bmsg_\d+\b/gi, '')
      .replace(/\[\s*ev_int_\d+\s*\]/gi, '')
      .replace(/\(\s*ev_int_\d+\s*\)/gi, '')
      .replace(/\bev_int_\d+\b/gi, '')
      .replace(/\bKey stats:\s*(-[^\n]*\n*)+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  story.title   = stripMsgIds(story.title);
  story.subtitle = stripMsgIds(story.subtitle);
  story.opening  = stripMsgIds(story.opening);

  for (const chapter of story.chapters || []) {
    chapter.title    = stripMsgIds(chapter.title);
    chapter.narrative = stripMsgIds(chapter.narrative);

    // Filter out internal evidence IDs or raw metadata from keyStats pills
    if (Array.isArray(chapter.keyStats)) {
      chapter.keyStats = chapter.keyStats.filter(st => {
        if (!st || !st.label || !st.value) return false;
        const val = String(st.value).toLowerCase();
        const lbl = String(st.label).toLowerCase();
        return !val.includes('ev_int_') &&
               !val.includes('msg_') &&
               !lbl.includes('evidence') &&
               !lbl.includes('ev_int');
      });
    }

    for (const pattern of GENERIC_FILLER_PATTERNS) {
      if (pattern.test(chapter.narrative)) {
        chapter.narrative = chapter.narrative.replace(pattern, 'the archive records');
      }
    }
  }

  if (story.awards) {
    for (const award of story.awards) {
      award.title  = stripMsgIds(award.title);
      award.reason = stripMsgIds(award.reason);
    }
  }

  if (story.verdict) {
    story.verdict.title       = stripMsgIds(story.verdict.title);
    story.verdict.description = stripMsgIds(story.verdict.description);
    story.verdict.badge       = stripMsgIds(story.verdict.badge);
  }

  story.ending = stripMsgIds(story.ending);
}

// ── § Baseline Story (model failure fallback) ─────────────────────────────────

/**
 * Builds a minimal evidence-grounded baseline story when the model fails entirely.
 * Does NOT use generic filler. Uses actual Story Memory interactions.
 */
function buildBaselineStory(storyMemory, metadata, summaryStats, storyAngles) {
  const participants = (metadata.participants || ['Participant A', 'Participant B']).join(' and ');
  const p1 = metadata.participants?.[0] || 'Participant A';
  const p2 = metadata.participants?.[1] || 'Participant B';
  const interactions = storyMemory?.highValueInteractions || [];

  const chapters = storyAngles.slice(0, 10).map((angle, i) => ({
    id: `chap_${i + 1}`,
    title: angle.title,
    period: angle.period || '',
    narrative: buildNarrativeFromAngle(angle, storyMemory),
    keyStats: angle.keyStats || [],
    evidenceIds: angle.evidenceIds || [],
    evidenceMessageIds: angle.evidenceIds || [],
  }));

  // Fill to 10 if storyAngles had fewer
  while (chapters.length < 10) {
    chapters.push(chapterFromMemorySlot(chapters.length, storyMemory));
  }

  const topPattern = storyMemory?.recurringPatterns?.[0];
  const rareM = storyMemory?.rareMemorableMoments?.[0];
  const topEmoji = summaryStats.mostUsedEmoji || '💀';

  return {
    title: `${p1.toUpperCase()} AND ${p2.toUpperCase()}: THE ARCHIVE`,
    subtitle: `${(metadata.totalMessages || 0).toLocaleString()} messages. Some of them were important.`,
    opening:
      `Alright. ${(metadata.totalMessages || 0).toLocaleString()} messages. ` +
      `${metadata.durationDays || 1} days. Peak activity at ${summaryStats.peakHour || 'some ungodly hour'} ` +
      `on ${summaryStats.peakDay || 'random weekdays'}. ` +
      `The archive has been read. Here's what was in it.\n\n` +
      (topPattern ? `The most documented pattern: "${topPattern.pattern}". ` : '') +
      `This is the story of that conversation.`,
    chapters,
    awards: [
      {
        id: 'award_1',
        title: '🏆 The Initiator Award',
        recipient: p1,
        reason: `Consistently started conversations and drove most of the documented interactions throughout the archive.`,
        emoji: '🏆',
        evidenceIds: interactions.slice(0, 1).map(h => h.evidenceId).filter(Boolean),
        evidenceMessageIds: interactions.slice(0, 1).map(h => h.evidenceId).filter(Boolean),
      },
      {
        id: 'award_2',
        title: '⚡ The Response Architect',
        recipient: p2,
        reason: `Consistently provided the responses that kept each exchange alive — including some that probably shouldn't have.`,
        emoji: '⚡',
        evidenceIds: interactions.slice(1, 2).map(h => h.evidenceId).filter(Boolean),
        evidenceMessageIds: interactions.slice(1, 2).map(h => h.evidenceId).filter(Boolean),
      },
      {
        id: 'award_3',
        title: `${topEmoji} The Emoji Commitment Medal`,
        recipient: p1,
        reason: `Awarded for sustained, high-volume deployment of ${topEmoji} across the archive — a documented consistency.`,
        emoji: topEmoji,
        evidenceIds: [],
        evidenceMessageIds: [],
      },
      {
        id: 'award_4',
        title: '🌟 The Rare Sincerity Trophy',
        recipient: rareM ? p1 : p2,
        reason: rareM
          ? `The archive records exactly one moment of genuine sincerity: "${rareM.summary}". This award exists because of it.`
          : `For occasionally dropping the bit at the right moment.`,
        emoji: '🌟',
        evidenceIds: rareM ? [rareM.evidenceId].filter(Boolean) : [],
        evidenceMessageIds: rareM ? [rareM.evidenceId].filter(Boolean) : [],
      },
    ],
    verdict: {
      title: 'CERTIFIED ACTIVE ARCHIVE',
      description:
        `After reading ${(metadata.totalMessages || 0).toLocaleString()} messages across ${metadata.durationDays || 1} days, ` +
        `the documented evidence confirms a consistent, specific conversational dynamic ` +
        `that has its own logic, its own running jokes, and its own unresolved questions.`,
      badge: 'DOCUMENTED ONGOING',
    },
    ending:
      `The archive is still open. The conversation is still going. ` +
      `Somewhere right now, one of them is typing something.`,
  };
}
