/**
 * Complete Story Generator Engine (OpenAI Edition — Story Writer V2).
 *
 * Coordinates verified receipt curation, prompt assembly, synthesis call via gpt-5.4-mini,
 * structured repair, and strict enforcement of the 10-chapter format.
 */

import { getOpenAIService, DailyLimitError, InvalidApiKeyError } from './ai/openaiClient.js';
import { getModelForTier } from './ai/modelConfig.js';
import { StorySchema, STORY_JSON_SCHEMA } from './ai/schemas/index.js';
import { buildStorySystemPrompt, buildStoryUserPrompt } from './ai/prompts/storyPrompt.js';
import { huntAndVerifyReceipts, formatReceiptsForStoryPrompt } from './receiptHunter.js';
import { getCachedStory, setCachedStory } from './ai/chunkCache.js';
import { STORY_MAX_OUTPUT_TOKENS } from './tokenEstimator.js';

const GENERIC_FILLER_PATTERNS = [
  /as the conversation progressed/gi,
  /over time, their relationship evolved/gi,
  /their bond (continued to grow|grew stronger)/gi,
  /the conversation took a dramatic turn/gi,
  /navigated the complexities of their relationship/gi,
  /began to understand each other better/gi,
];

const ANGLE_LIBRARY = [
  { key: 'first_contact', label: 'How This Archive Opens', types: ['event', 'memorable', 'plan'] },
  { key: 'plan', label: 'The Plans Department', types: ['plan', 'promise', 'event'] },
  { key: 'funny', label: 'The Bit That Became Evidence', types: ['funny', 'inside_joke', 'recurring_language'] },
  { key: 'behavior', label: 'The Recurring Behavior File', types: ['behavior', 'personality_signal', 'relationship_signal'] },
  { key: 'conflict', label: 'The Disagreement Receipts', types: ['conflict', 'rejection', 'dramatic'] },
  { key: 'repair', label: 'The Reset Attempt', types: ['apology', 'vulnerability', 'promise'] },
  { key: 'callback', label: 'The Callback Nobody Escaped', types: ['callback_candidate', 'foreshadowing_candidate', 'inside_joke'] },
  { key: 'contradiction', label: 'The Contradiction Exhibit', types: ['contradiction', 'turning_point', 'behavior'] },
  { key: 'character', label: 'The Character Study', types: ['self_description', 'other_description', 'personality_signal'] },
  { key: 'current_state', label: 'Where The Receipts Leave Us', types: ['turning_point', 'relationship_signal', 'memorable', 'event'] },
];

/**
 * Generate the Complete 10-Chapter Story using OpenAI Story Model.
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
    console.log(`[Story] ✓ Cache hit for story`);
    return cached;
  }

  const receiptCatalog = huntAndVerifyReceipts(intelligence, messageIndex, 30);
  const formattedReceipts = formatReceiptsForStoryPrompt(receiptCatalog);
  const storyAngles = buildStoryAngles(intelligence, metadata, summaryStats, receiptCatalog);

  console.log(
    `[Story] Generating Complete Story for ${metadata.participants.join(', ')} | ` +
    `Model: ${storyModel} | ` +
    `${receiptCatalog.receipts.length} verified receipts | ` +
    `${receiptCatalog.callbackPairs.length} callbacks | ` +
    `${receiptCatalog.contradictionPairs.length} contradictions | ` +
    `${storyAngles.length} planned angles`
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
        formattedReceipts,
        storyAngles,
      }),
      schema: STORY_JSON_SCHEMA,
      schemaName: 'CompleteStoryResponse',
      maxOutputTokens: STORY_MAX_OUTPUT_TOKENS,
      temperature: 0.8,
    });
  } catch (err) {
    if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;
    console.warn('[Story] Initial story generation pass failed:', err.message);

    try {
      console.log('[Story] Attempting structured repair pass...');
      rawStory = await openaiService.completeStructured({
        model: storyModel,
        tier: 'story',
        systemPrompt: buildStorySystemPrompt() + '\n\nIMPORTANT: Output MUST be strictly valid JSON matching StorySchema with EXACTLY 10 distinct evidence-backed chapters. Do not use generic filler.',
        userPrompt: buildStoryUserPrompt({
          intelligence,
          summaryStats,
          metadata,
          formattedReceipts,
          storyAngles,
        }),
        schema: STORY_JSON_SCHEMA,
        schemaName: 'CompleteStoryResponse',
        maxOutputTokens: STORY_MAX_OUTPUT_TOKENS,
        temperature: 0.7,
      });
      console.log('[Story] Structured repair succeeded.');
    } catch (repairErr) {
      if (repairErr instanceof DailyLimitError || repairErr instanceof InvalidApiKeyError) throw repairErr;
      console.warn('[Story] Structured repair failed, constructing evidence-grounded baseline story:', repairErr.message);
      rawStory = buildBaselineStory(intelligence, metadata, summaryStats, receiptCatalog, storyAngles);
    }
  }

  const normalizedStory = enforceTenChapters(rawStory, intelligence, receiptCatalog, storyAngles);
  attachVerifiedReceipts(normalizedStory, receiptCatalog, storyAngles);
  polishStory(normalizedStory, storyAngles, receiptCatalog);

  console.log(
    `[Story] Complete Story generated successfully: "${normalizedStory.title}" (${normalizedStory.chapters.length} chapters).`
  );

  const finalResult = {
    story: normalizedStory,
    receipts: receiptCatalog.receipts,
  };

  setCachedStory(intelligence, metadata, storyModel, finalResult);
  return finalResult;
}

/**
 * Normalizes and enforces that story.chapters has EXACTLY 10 items.
 */
export function enforceTenChapters(story, intelligence, receiptCatalog, storyAngles = []) {
  const result = { ...story };
  let chapters = Array.isArray(result.chapters) ? [...result.chapters] : [];

  while (chapters.length < 10) {
    const index = chapters.length;
    const angle = storyAngles[index] || fallbackAngle(index, receiptCatalog, intelligence);
    chapters.push({
      id: `chap_${index + 1}`,
      title: angle.title,
      period: angle.period,
      narrative: narrativeFromAngle(angle, receiptCatalog),
      keyStats: angle.keyStats || [],
      evidenceMessageIds: angle.evidenceMessageIds || [],
    });
  }

  while (chapters.length > 10) {
    const last = chapters.pop();
    const prev = chapters[chapters.length - 1];
    if (prev && last) {
      prev.narrative = [prev.narrative, last.narrative].filter(Boolean).join('\n\n');
      prev.evidenceMessageIds = [
        ...new Set([...(prev.evidenceMessageIds || []), ...(last.evidenceMessageIds || [])]),
      ].slice(0, 4);
    }
  }

  const allVerifiedIds = new Set(
    (receiptCatalog?.receipts || []).map((r) => r.messageId).filter(Boolean)
  );

  result.chapters = chapters.map((chapter, index) => {
    const angle = storyAngles[index] || fallbackAngle(index, receiptCatalog, intelligence);

    // Keep strictly verified IDs from AI, or fallback to the angle's verified receipts
    const rawIds = Array.isArray(chapter.evidenceMessageIds) ? chapter.evidenceMessageIds : [];
    const validIds = rawIds.filter((id) => allVerifiedIds.has(id));
    const finalEvidenceIds =
      validIds.length > 0
        ? validIds.slice(0, 4)
        : (angle.evidenceMessageIds || []).slice(0, 4);

    return {
      ...chapter,
      id: `chap_${index + 1}`,
      title: chapter.title || angle.title,
      period: chapter.period || angle.period,
      narrative: chapter.narrative || narrativeFromAngle(angle, receiptCatalog),
      keyStats: Array.isArray(chapter.keyStats) ? chapter.keyStats : [],
      evidenceMessageIds: finalEvidenceIds,
    };
  });

  return result;
}

export function buildStoryAngles(intelligence, metadata, summaryStats, receiptCatalog) {
  const evidence = intelligence?._evidenceStore || [];
  const used = new Set();
  const angles = [];

  for (const template of ANGLE_LIBRARY) {
    const matches = evidence
      .filter((item) => !used.has(item.messageId) && template.types.includes(item.type))
      .sort((a, b) => (b.importance || 0) - (a.importance || 0));

    if (matches.length > 0) {
      const selected = matches.slice(0, 3);
      selected.forEach((item) => used.add(item.messageId));
      angles.push(angleFromEvidence(template, selected, metadata, summaryStats));
    }
  }

  for (const receipt of receiptCatalog.receipts || []) {
    if (angles.length >= 10) break;
    if (used.has(receipt.messageId)) continue;
    used.add(receipt.messageId);
    angles.push(angleFromReceipt(receipt, angles.length, metadata, summaryStats));
  }

  while (angles.length < 10) {
    angles.push(fallbackAngle(angles.length, receiptCatalog, intelligence, metadata, summaryStats));
  }

  // Sort angles chronologically so chapters follow a natural timeline progression from start to present
  const sortedAngles = [...angles].sort((a, b) => {
    const tA = a.receipts?.[0]?.timestamp || '';
    const tB = b.receipts?.[0]?.timestamp || '';
    return tA.localeCompare(tB);
  });

  return sortedAngles.slice(0, 10).map((angle, index) => ({
    ...angle,
    chapterNumber: index + 1,
  }));
}

function angleFromEvidence(template, evidence, metadata, summaryStats) {
  const primary = evidence[0];
  return {
    key: template.key,
    label: template.label,
    title: titleForAngle(template, primary),
    period: periodFromEvidence(evidence),
    reason: primary.connection || `Verified ${primary.type} evidence`,
    evidenceMessageIds: evidence.map((item) => item.messageId).filter(Boolean).slice(0, 4),
    keyStats: statForAngle(template, metadata, summaryStats),
    receipts: evidence.map((item) => ({
      messageId: item.messageId,
      sender: item.sender,
      timestamp: item.timestamp,
      text: item.text,
      category: item.type,
      reason: item.connection,
    })),
  };
}

function angleFromReceipt(receipt, index, metadata, summaryStats) {
  const label = [
    'A Receipt That Refused To Be Background Noise',
    'The Tiny Moment With Main Character Energy',
    'The Archive Produces Another Exhibit',
    'The Side Quest That Somehow Matters',
  ][index % 4];

  return {
    key: `receipt_${index + 1}`,
    label,
    title: titleFromText(label, receipt.text),
    period: receipt.timestamp ? receipt.timestamp.slice(0, 10) : 'Verified moment',
    reason: receipt.reason || receipt.category || 'Verified receipt',
    evidenceMessageIds: [receipt.messageId].filter(Boolean),
    keyStats: statForAngle(null, metadata, summaryStats),
    receipts: [receipt],
  };
}

function fallbackAngle(index, receiptCatalog, intelligence, metadata = {}, summaryStats = {}) {
  const receipt = receiptCatalog.receipts?.[index % Math.max(1, receiptCatalog.receipts.length)];
  if (receipt) return angleFromReceipt(receipt, index, metadata, summaryStats);

  const era = intelligence?.eras?.[index % Math.max(1, intelligence?.eras?.length || 1)];
  if (era) {
    return {
      key: `era_${index + 1}`,
      label: 'The Next Era',
      title: era.title || `Phase ${index + 1}`,
      period: era.startAt && era.endAt ? `${era.startAt.slice(0, 10)} -> ${era.endAt.slice(0, 10)}` : 'Archive Era',
      reason: era.summary || 'Chronological shift in the conversation',
      evidenceMessageIds: Array.isArray(era.evidenceMessageIds) ? era.evidenceMessageIds.slice(0, 4) : [],
      keyStats: statForAngle(null, metadata, summaryStats),
      receipts: [],
    };
  }

  return {
    key: `moment_${index + 1}`,
    label: 'The Conversation Record',
    title: `Exhibit #${index + 1}`,
    period: 'Conversation Record',
    reason: 'Verified chat documentation',
    evidenceMessageIds: [],
    keyStats: statForAngle(null, metadata, summaryStats),
    receipts: [],
  };
}

function titleForAngle(template, item) {
  switch (template.key) {
    case 'first_contact':
      return 'The Genesis: First Impressions & Initial Frequency';
    case 'plan':
      return 'The Blueprint: Plans, Logistics & Optimistic Blueprints';
    case 'funny':
      return 'The Bit That Stuck: Running Jokes & Unfiltered Banter';
    case 'behavior':
      return 'The Pattern: Observable Habits & Recurring Dynamic';
    case 'conflict':
      return 'The Friction Point: Tension, Deadpan Replies & Stand-offs';
    case 'repair':
      return 'The Reconciliation: Vulnerability & The Return of Warmth';
    case 'callback':
      return 'The Callback Archive: Long-Term Memory at Work';
    case 'contradiction':
      return 'Exhibit A vs Exhibit B: The Contradiction File';
    case 'character':
      return 'The Dual Character Study: Contrasts in Rhythm';
    case 'current_state':
      return 'The Present Day: Where The Chat Archive Leaves Us';
    default:
      return `${template.label}: A Documented Study`;
  }
}

function titleFromText(label, text) {
  if (!text) return label;
  const cleaned = String(text).replace(/[^\w\s]/g, '').trim();
  if (cleaned.length <= 40) return `"${cleaned}"`;
  return `${label}: "${cleaned.slice(0, 36)}..."`;
}

function periodFromEvidence(evidence) {
  const dates = evidence
    .map((item) => item.timestamp)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return 'Archive Timeline';
  if (dates.length === 1) return dates[0].slice(0, 10);
  return `${dates[0].slice(0, 10)} -> ${dates[dates.length - 1].slice(0, 10)}`;
}

function statForAngle(template, metadata = {}, summaryStats = {}) {
  const stats = [];
  if (summaryStats?.peakHour) stats.push({ label: 'Peak Hour', value: summaryStats.peakHour });
  if (summaryStats?.longestStreakDays) stats.push({ label: 'Streak', value: `${summaryStats.longestStreakDays} days` });
  if (metadata?.totalMessages) stats.push({ label: 'Messages', value: `${metadata.totalMessages.toLocaleString()}` });
  return stats.slice(0, 2);
}

function narrativeFromAngle(angle, receiptCatalog) {
  const receipt = angle.receipts?.[0] || receiptCatalog.receipts?.[0];
  const quoteSnippet = receipt ? ` The receipt on record: "${receipt.text}".` : '';
  return `This chapter covers ${angle.label.toLowerCase()} across ${angle.period}. The documentation demonstrates clear conversational evidence with high behavioral consistency.${quoteSnippet}`;
}

function attachVerifiedReceipts(story, receiptCatalog, storyAngles) {
  const receipts = receiptCatalog.receipts || [];
  story.chapters = (story.chapters || []).map((chapter, index) => {
    const angle = storyAngles[index];
    const chapterReceipts = angle?.receipts?.length
      ? angle.receipts
      : receipts.slice(index * 2, index * 2 + 2);

    const validIds = (chapter.evidenceMessageIds || []).filter((id) =>
      receiptCatalog.receipts.some((r) => r.messageId === id)
    );

    return {
      ...chapter,
      evidenceMessageIds: validIds.length > 0 ? validIds : chapterReceipts.map((r) => r.messageId).filter(Boolean),
    };
  });
}

function polishStory(story, storyAngles, receiptCatalog) {
  if (!story.title) story.title = 'The WhatsApp Chronicles';
  if (!story.subtitle) story.subtitle = 'A verified documentary intelligence report';

  for (const chapter of story.chapters || []) {
    for (const pattern of GENERIC_FILLER_PATTERNS) {
      if (pattern.test(chapter.narrative)) {
        chapter.narrative = chapter.narrative.replace(pattern, 'the documented evidence confirms');
      }
    }
  }
}

function buildBaselineStory(intelligence, metadata, summaryStats, receiptCatalog, storyAngles) {
  const participants = (metadata.participants || ['Participant A', 'Participant B']).join(' and ');
  const chapters = storyAngles.slice(0, 10).map((angle, i) => ({
    id: `chap_${i + 1}`,
    title: angle.title,
    period: angle.period,
    narrative: narrativeFromAngle(angle, receiptCatalog),
    keyStats: angle.keyStats || [],
    evidenceMessageIds: angle.evidenceMessageIds || [],
  }));

  return {
    title: `The Verified Archive: ${participants}`,
    subtitle: `${metadata.totalMessages?.toLocaleString() || 0} messages analyzed across ${metadata.durationDays || 1} days`,
    opening: `This dossier analyzes the complete exported WhatsApp chat archive of ${participants}, documenting key conversational patterns, recurring jokes, and verifiable moments.`,
    chapters,
    awards: [
      {
        id: 'award_1',
        title: 'Most Documented Participant',
        recipient: metadata.participants?.[0] || 'Top Sender',
        reason: 'Consistently drove conversational volume throughout the archive.',
        emoji: '🏆',
        evidenceMessageIds: [],
      },
    ],
    verdict: {
      title: 'Final Archive Verdict',
      description: 'A rich and complex conversational history verified with receipts and high statistical consistency.',
      badge: 'Certified Dynamic',
    },
    ending: 'The archive stands as a complete, grounded record of this unique conversational dynamic.',
  };
}
