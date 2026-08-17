/**
 * Complete Story Generator Engine.
 *
 * Coordinates verified receipt curation, prompt assembly, synthesis call,
 * structured repair, and strict enforcement of the 10-chapter format.
 */

import { GroqProvider, DailyLimitError, InvalidApiKeyError } from './ai/groq.js';
import { StorySchema } from './ai/schemas/index.js';
import { buildStorySystemPrompt, buildStoryUserPrompt } from './ai/prompts/storyPrompt.js';
import { huntAndVerifyReceipts, formatReceiptsForStoryPrompt } from './receiptHunter.js';

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
 * Generate the Complete 10-Chapter Story.
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
  const receiptCatalog = huntAndVerifyReceipts(intelligence, messageIndex, 30);
  const formattedReceipts = formatReceiptsForStoryPrompt(receiptCatalog);
  const storyAngles = buildStoryAngles(intelligence, metadata, summaryStats, receiptCatalog);

  console.log(
    `[Story] Generating Complete Story for ${metadata.participants.join(', ')} | ` +
    `${receiptCatalog.receipts.length} verified receipts | ` +
    `${receiptCatalog.callbackPairs.length} callbacks | ` +
    `${receiptCatalog.contradictionPairs.length} contradictions | ` +
    `${storyAngles.length} planned angles`
  );

  const provider = new GroqProvider();
  let rawStory = null;

  try {
    rawStory = await provider.complete({
      systemPrompt: buildStorySystemPrompt(),
      userPrompt: buildStoryUserPrompt({
        intelligence,
        summaryStats,
        metadata,
        formattedReceipts,
        storyAngles,
      }),
      schema: StorySchema,
      tier: 'synthesis',
      maxOutputTokens: 3800,
      temperature: 0.8,
    });
  } catch (err) {
    if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;
    console.warn('[Story] Initial story generation pass failed:', err.message);

    try {
      console.log('[Story] Attempting structured repair pass...');
      rawStory = await provider.complete({
        systemPrompt: buildStorySystemPrompt() + '\n\nIMPORTANT: Output MUST be strictly valid JSON matching StorySchema with EXACTLY 10 distinct evidence-backed chapters. Do not use generic filler.',
        userPrompt: buildStoryUserPrompt({
          intelligence,
          summaryStats,
          metadata,
          formattedReceipts,
          storyAngles,
        }),
        schema: StorySchema,
        tier: 'synthesis',
        maxOutputTokens: 3800,
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

  return {
    story: normalizedStory,
    receipts: receiptCatalog.receipts,
  };
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

  result.chapters = chapters.map((chapter, index) => {
    const angle = storyAngles[index] || fallbackAngle(index, receiptCatalog, intelligence);
    return {
      ...chapter,
      id: `chap_${index + 1}`,
      title: chapter.title || angle.title,
      period: chapter.period || angle.period,
      narrative: chapter.narrative || narrativeFromAngle(angle, receiptCatalog),
      keyStats: Array.isArray(chapter.keyStats) ? chapter.keyStats : [],
      evidenceMessageIds: Array.isArray(chapter.evidenceMessageIds)
        ? chapter.evidenceMessageIds.slice(0, 4)
        : [],
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
      .filter(item => !used.has(item.messageId) && template.types.includes(item.type))
      .sort((a, b) => (b.importance || 0) - (a.importance || 0));

    if (matches.length > 0) {
      const selected = matches.slice(0, 3);
      selected.forEach(item => used.add(item.messageId));
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

  return angles.slice(0, 10).map((angle, index) => ({
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
    evidenceMessageIds: evidence.map(item => item.messageId).filter(Boolean).slice(0, 4),
    keyStats: statForAngle(template, metadata, summaryStats),
    receipts: evidence.map(item => ({
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
  return {
    key: `fallback_${index + 1}`,
    label: 'The Evidence-Light Chapter',
    title: era?.title || `Receipt Gap, Chapter ${index + 1}`,
    period: era ? `${era.startAt || ''} to ${era.endAt || ''}`.trim() : 'Timeline',
    reason: era?.summary || 'Limited verified evidence available for this angle',
    evidenceMessageIds: era?.evidenceMessageIds || [],
    keyStats: statForAngle(null, metadata, summaryStats),
    receipts: [],
  };
}

function titleForAngle(template, primary) {
  const textTitle = titleFromText(template.label, primary.text || primary.connection || '');
  const typeTitles = {
    plan: 'The Plans Department Opened A Case',
    funny: 'The Bit Entered The Record',
    behavior: 'A Pattern Started Looking Suspicious',
    conflict: 'The Receipts Got Spicy',
    repair: 'Somebody Tried To Reset The Room',
    callback: 'The Callback Came Back With Receipts',
    contradiction: 'The Archive Noticed The Math Was Not Mathing',
    character: 'The Character Evidence Became Too Loud',
    current_state: 'Where The Receipts Leave Everybody',
  };
  return typeTitles[template.key] || textTitle;
}

function titleFromText(label, text = '') {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return label;
  const snippet = clean.length > 44 ? `${clean.slice(0, 41)}...` : clean;
  return `${label}: "${snippet}"`;
}

function periodFromEvidence(evidence) {
  const dates = evidence.map(item => item.timestamp).filter(Boolean).sort();
  if (dates.length === 0) return 'Verified period';
  const start = dates[0].slice(0, 10);
  const end = dates[dates.length - 1].slice(0, 10);
  return start === end ? start : `${start} to ${end}`;
}

function statForAngle(template, metadata = {}, summaryStats = {}) {
  if (template?.key === 'current_state' && metadata.durationDays !== undefined) {
    return [{ label: 'Days Covered', value: String(metadata.durationDays) }];
  }
  if (template?.key === 'funny' && summaryStats.mostUsedEmoji) {
    return [{ label: 'Top Emoji', value: summaryStats.mostUsedEmoji }];
  }
  return [];
}

function narrativeFromAngle(angle, receiptCatalog) {
  const receipts = angle.receipts?.length
    ? angle.receipts
    : (receiptCatalog.receipts || []).filter(r => angle.evidenceMessageIds?.includes(r.messageId));
  const receiptLines = receipts
    .slice(0, 3)
    .map(r => {
      const who = r.sender || 'Someone';
      const text = r.text ? `"${r.text}"` : `receipt ${r.messageId}`;
      return `${who} gave the chapter its receipt with ${text}`;
    });

  const evidenceLine = receiptLines.length
    ? receiptLines.join('. ') + '.'
    : 'The verified archive is light here, so this chapter stays careful instead of making things up.';

  return `${angle.label}. ${evidenceLine}\n\nThat matters because ${angle.reason || 'this is one of the verified angles the evidence supports'}. The chapter does not need fake drama; the receipt is doing the work.`;
}

function attachVerifiedReceipts(story, receiptCatalog, storyAngles) {
  const verifiedIds = new Set((receiptCatalog.receipts || []).map(r => r.messageId));
  for (const [index, chapter] of story.chapters.entries()) {
    const valid = (chapter.evidenceMessageIds || []).filter(id => verifiedIds.has(id));
    if (valid.length > 0) {
      chapter.evidenceMessageIds = [...new Set(valid)].slice(0, 4);
      continue;
    }

    const angleIds = (storyAngles[index]?.evidenceMessageIds || []).filter(id => verifiedIds.has(id));
    if (angleIds.length > 0) {
      chapter.evidenceMessageIds = angleIds.slice(0, 4);
      continue;
    }

    chapter.evidenceMessageIds = receiptCatalog.receipts?.[index % Math.max(1, receiptCatalog.receipts.length)]
      ? [receiptCatalog.receipts[index % receiptCatalog.receipts.length].messageId]
      : [];
  }
}

function polishStory(story, storyAngles, receiptCatalog) {
  for (const [index, chapter] of story.chapters.entries()) {
    let narrative = String(chapter.narrative || '');

    // 1. Clean out raw internal message ID tags like (msg_123) or msg_456
    narrative = narrative
      .replace(/\s*\(\s*msg_\w+\s*\)/gi, '')
      .replace(/\s*«MSG::[^:]*::([^»]*)»/gi, ' "$1" ')
      .replace(/RECEIPT\s*\n\s*[^:\n]+:\s*"([^"]+)"/gi, ' "$1" ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");

    // 2. Strip generic filler phrases
    for (const pattern of GENERIC_FILLER_PATTERNS) {
      narrative = narrative.replace(
        new RegExp(pattern.source, 'gi'),
        'In the verified receipts'
      );
    }

    chapter.narrative = narrative.trim();

    if (isTooGeneric(chapter.narrative)) {
      const angle = storyAngles[index] || fallbackAngle(index, receiptCatalog, null);
      chapter.narrative = narrativeFromAngle(angle, receiptCatalog);
    }
    chapter.title = chapter.title || storyAngles[index]?.title || `Chapter ${index + 1}`;
    chapter.period = chapter.period || storyAngles[index]?.period || 'Timeline';
  }
}

function isTooGeneric(text = '') {
  const normalized = String(text).toLowerCase();
  return GENERIC_FILLER_PATTERNS.some(pattern => new RegExp(pattern.source, 'i').test(normalized)) ||
    normalized.trim().length < 80;
}

function buildBaselineStory(intelligence, metadata, summaryStats, receiptCatalog, storyAngles = []) {
  const participants = metadata.participants.join(', ');
  const totalMsgs = metadata.totalMessages.toLocaleString();
  const angles = storyAngles.length
    ? storyAngles
    : buildStoryAngles(intelligence, metadata, summaryStats, receiptCatalog);

  return {
    title: `The Receipts of ${participants}`,
    subtitle: `${totalMsgs} messages, filtered through the evidence that actually checks out.`,
    opening: `${participants} left behind ${totalMsgs} messages across ${metadata.durationDays} days.\n\nThis version does not pretend the chat is romantic, dramatic, or iconic unless the receipts say so. It follows the verified moments and lets the archive embarrass everyone fairly.`,
    chapters: angles.map((angle, index) => ({
      id: `chap_${index + 1}`,
      title: angle.title,
      period: angle.period,
      narrative: narrativeFromAngle(angle, receiptCatalog),
      keyStats: angle.keyStats || [],
      evidenceMessageIds: angle.evidenceMessageIds || [],
    })),
    awards: metadata.participants.map((name, index) => ({
      id: `award_${index + 1}`,
      title: index === 0 ? 'Receipt Starter' : 'Certified Co-Star',
      recipient: name,
      reason: 'Appears in the verified archive without needing the narrator to invent a character arc.',
      emoji: 'trophy',
      evidenceMessageIds: receiptCatalog.receipts.slice(index, index + 1).map(r => r.messageId),
    })),
    verdict: {
      title: 'THE RECEIPTS DECIDED',
      description: `Across ${metadata.durationDays} days, the strongest story is the one supported by verified moments. Anything without a receipt stays outside the narrative.`,
      badge: 'Evidence-Backed Lore',
    },
    ending: 'The archive does not need exaggeration. The useful parts are already in the receipts.',
  };
}
