/**
 * Compact Memory Builder
 *
 * Takes raw CompactChunkExtraction[] results and produces a single
 * CompactChatMemory that is:
 *   1. Deduplicated (similar topics/events merged)
 *   2. Compressed (top-N selected, low-value items dropped)
 *   3. Token-bounded (target: 5k–15k tokens for synthesis input)
 *
 * This is the critical compression stage between:
 *   small model extraction → compact memory → 70B synthesis
 */

import { estimateObjectTokens, MAX_MEMORY_TOKENS } from './tokenEstimator.js';

// ─── Memory Size Caps ─────────────────────────────────────────────────────────

const MAX_PERIODS = 30;
const MAX_GLOBAL_TOPICS = 25;
const MAX_GLOBAL_EVENTS = 50;
const MAX_GLOBAL_MOMENTS = 30;
const MAX_GLOBAL_PATTERNS = 20;
const MAX_RECURRING_THEMES = 20;
const MAX_EVENTS_PER_PERIOD = 4;
const MAX_MOMENTS_PER_PERIOD = 3;

/**
 * Build a CompactChatMemory from chunk extractions.
 *
 * @param {Array} extractions  — CompactChunkExtraction[] (raw from AI)
 * @param {Array} chunks       — AnalysisChunk[] (for date ranges + message counts)
 * @param {Object} metadata    — from request (participants, totalMessages, etc.)
 * @param {Object} [extractionMeta] — { chunksTotal, chunksSucceeded, chunksFailed, extractionModel }
 * @returns {Object} CompactChatMemory
 */
export function buildCompactMemory(extractions, chunks, metadata, extractionMeta = {}) {
  // ── 1. Build per-period data ───────────────────────────────────────────────
  const periods = buildPeriods(extractions, chunks);

  // ── 2. Aggregate + deduplicate globally ───────────────────────────────────
  const globalTopics = deduplicateStrings(
    extractions.flatMap(e => e.topics || []),
    MAX_GLOBAL_TOPICS
  );

  const globalEvents = deduplicateEvidence(
    extractions.flatMap(e => e.events || []),
    MAX_GLOBAL_EVENTS
  );

  const globalMoments = deduplicateEvidence(
    extractions.flatMap(e => e.notableMoments || []),
    MAX_GLOBAL_MOMENTS
  );

  const globalPatterns = deduplicateEvidence(
    extractions.flatMap(e => e.patterns || []),
    MAX_GLOBAL_PATTERNS
  );

  const recurringThemes = deduplicateStrings(
    extractions.flatMap(e => e.recurringThemes || []),
    MAX_RECURRING_THEMES
  );

  // ── 3. Participant stats from metadata ────────────────────────────────────
  const participants = (metadata.participants || []).map(name => ({
    name,
    messageCount: 0, // Phase 2 stats not available here; set by caller if needed
    percentage: 0,
  }));

  // ── 4. Build the memory object ────────────────────────────────────────────
  const timelineStart =
    chunks[0]?.startAt ??
    extractions[0]?.period?.start ??
    'unknown';
  const timelineEnd =
    chunks[chunks.length - 1]?.endAt ??
    extractions[extractions.length - 1]?.period?.end ??
    'unknown';

  let memory = {
    timelineStart,
    timelineEnd,
    totalMessages: metadata.totalMessages ?? 0,
    participants,
    periods,
    globalTopics,
    globalEvents,
    globalMoments,
    globalPatterns,
    recurringThemes,
    _meta: {
      chunksTotal: extractionMeta.chunksTotal ?? extractions.length,
      chunksSucceeded: extractionMeta.chunksSucceeded ?? extractions.length,
      chunksFailed: extractionMeta.chunksFailed ?? 0,
      extractionModel: extractionMeta.extractionModel ?? 'unknown',
    },
  };

  // ── 5. Token-budget trim if memory is still too large ─────────────────────
  memory = trimMemoryToTokenBudget(memory);

  const estimatedTokens = estimateObjectTokens(memory);
  console.log(
    `[Memory] Compact memory built: ${periods.length} periods, ` +
    `${globalEvents.length} events, ${globalMoments.length} moments, ` +
    `~${estimatedTokens} estimated tokens`
  );

  return memory;
}

// ─── Period Builder ───────────────────────────────────────────────────────────

function buildPeriods(extractions, chunks) {
  // Pair each extraction with its chunk (same order)
  const periods = extractions.map((extraction, i) => {
    const chunk = chunks[i];
    return {
      dateRange: chunk
        ? `${formatDate(chunk.startAt)} → ${formatDate(chunk.endAt)}`
        : `${formatDate(extraction.period?.start)} → ${formatDate(extraction.period?.end)}`,
      messageCount: chunk?.messages?.length ?? 0,
      topics: (extraction.topics || []).slice(0, 5),
      events: (extraction.events || []).slice(0, MAX_EVENTS_PER_PERIOD),
      notableMoments: (extraction.notableMoments || []).slice(0, MAX_MOMENTS_PER_PERIOD),
      recurringThemes: (extraction.recurringThemes || []).slice(0, 3),
    };
  });

  // If too many periods, sample evenly
  if (periods.length > MAX_PERIODS) {
    return sampleEvenly(periods, MAX_PERIODS);
  }

  return periods;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Deduplicate an array of strings by normalized key.
 * Keeps the most specific/longer version, sorted by frequency.
 *
 * @param {string[]} strings
 * @param {number} maxCount
 * @returns {string[]}
 */
function deduplicateStrings(strings, maxCount) {
  const freq = new Map();
  const canonical = new Map(); // normalKey → best full string

  for (const s of strings) {
    if (!s || typeof s !== 'string') continue;
    const key = normalizeKey(s);
    freq.set(key, (freq.get(key) || 0) + 1);
    // Keep longer/more specific version
    if (!canonical.has(key) || s.length > canonical.get(key).length) {
      canonical.set(key, s);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([key]) => canonical.get(key));
}

/**
 * Deduplicate evidence items (description + messageIds).
 * Items with similar normalized descriptions get merged:
 * their messageIds are unioned.
 *
 * @param {Array<{ description: string, messageIds: string[] }>} items
 * @param {number} maxCount
 * @returns {Array<{ description: string, messageIds: string[] }>}
 */
function deduplicateEvidence(items, maxCount) {
  const groups = new Map(); // normalKey → { description, messageIds: Set, score }

  for (const item of items) {
    if (!item?.description) continue;
    const key = normalizeKey(item.description);

    if (!groups.has(key)) {
      groups.set(key, {
        description: item.description,
        messageIds: new Set(item.messageIds || []),
        score: 0,
      });
    } else {
      const g = groups.get(key);
      // Keep longer description (more detail wins)
      if (item.description.length > g.description.length) {
        g.description = item.description;
      }
      // Union message IDs
      for (const id of item.messageIds || []) g.messageIds.add(id);
    }
    // Score = number of supporting messages (more evidence = higher priority)
    groups.get(key).score += (item.messageIds?.length || 0) + 1;
  }

  return [...groups.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map(g => ({
      description: g.description,
      messageIds: [...g.messageIds],
    }));
}

/**
 * Normalize a string to a deduplication key.
 * Lowercases, strips punctuation, collapses whitespace.
 * Takes only the first 8 significant words to catch near-duplicates.
 */
function normalizeKey(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 2) // remove short words like "the", "a", "is"
    .slice(0, 8)
    .join(' ');
}

// ─── Token Budget Trimmer ─────────────────────────────────────────────────────

/**
 * If the memory object is larger than MAX_MEMORY_TOKENS,
 * progressively trim it until it fits.
 *
 * Trimming priority (least important first):
 * 1. Reduce period events/moments per period
 * 2. Reduce globalMoments count
 * 3. Reduce globalEvents count
 * 4. Reduce globalPatterns count
 * 5. Sample periods down further
 */
function trimMemoryToTokenBudget(memory) {
  if (estimateObjectTokens(memory) <= MAX_MEMORY_TOKENS) return memory;

  // Round 1: cap period events/moments
  memory = {
    ...memory,
    periods: memory.periods.map(p => ({
      ...p,
      events: p.events.slice(0, 2),
      notableMoments: p.notableMoments.slice(0, 2),
    })),
  };
  if (estimateObjectTokens(memory) <= MAX_MEMORY_TOKENS) return memory;

  // Round 2: trim global moments
  const momentSteps = [20, 15, 10, 5];
  for (const cap of momentSteps) {
    memory = { ...memory, globalMoments: memory.globalMoments.slice(0, cap) };
    if (estimateObjectTokens(memory) <= MAX_MEMORY_TOKENS) return memory;
  }

  // Round 3: trim global events
  const eventSteps = [35, 25, 15, 10];
  for (const cap of eventSteps) {
    memory = { ...memory, globalEvents: memory.globalEvents.slice(0, cap) };
    if (estimateObjectTokens(memory) <= MAX_MEMORY_TOKENS) return memory;
  }

  // Round 4: trim global patterns
  memory = { ...memory, globalPatterns: memory.globalPatterns.slice(0, 10) };
  if (estimateObjectTokens(memory) <= MAX_MEMORY_TOKENS) return memory;

  // Round 5: reduce period events to 1 each and drop moments
  memory = {
    ...memory,
    periods: memory.periods.map(p => ({
      ...p,
      events: p.events.slice(0, 1),
      notableMoments: [],
    })),
  };
  if (estimateObjectTokens(memory) <= MAX_MEMORY_TOKENS) return memory;

  // Round 6: sample periods down aggressively
  memory = {
    ...memory,
    periods: sampleEvenly(memory.periods, 15),
  };

  console.warn(
    `[Memory] Memory still large after trimming: ~${estimateObjectTokens(memory)} tokens. ` +
    `Consider increasing MAX_MEMORY_TOKENS or reducing MAX_EXTRACTION_INPUT_TOKENS.`
  );

  return memory;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return 'unknown';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Sample `count` evenly-spaced items from an array.
 * Always includes the first and last items.
 */
function sampleEvenly(arr, count) {
  if (arr.length <= count) return arr;
  const result = [arr[0]];
  const step = (arr.length - 1) / (count - 1);
  for (let i = 1; i < count - 1; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  result.push(arr[arr.length - 1]);
  return result;
}
