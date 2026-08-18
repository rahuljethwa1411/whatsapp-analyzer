/**
 * Evidence Retriever
 * Validates and retrieves real messages by ID.
 * Critical for receipts — never allows invented message IDs.
 */

/**
 * Build a fast lookup map from all messages.
 * @param {Array} allMessages — all ChatMessage[] from the request
 * @returns {Map<string, Object>}
 */
export function buildMessageIndex(allMessages) {
  const index = new Map();
  for (const m of allMessages) {
    index.set(m.id, m);
  }
  return index;
}

/**
 * Retrieves messages by IDs.
 * Only returns IDs that actually exist in the index.
 * Silently drops any invented or invalid IDs.
 * @param {string[]} ids
 * @param {Map<string, Object>} messageIndex
 * @returns {Array}
 */
export function getMessagesByIds(ids, messageIndex) {
  if (!Array.isArray(ids)) return [];
  return ids
    .filter(id => messageIndex.has(id))
    .map(id => messageIndex.get(id));
}

/**
 * Validates an array of message IDs against the real index.
 * Returns only the valid IDs.
 * @param {string[]} ids
 * @param {Map<string, Object>} messageIndex
 * @returns {string[]}
 */
export function validateMessageIds(ids, messageIndex) {
  if (!Array.isArray(ids)) return [];
  return ids.filter(id => typeof id === 'string' && messageIndex.has(id));
}

/**
 * Validates all evidenceMessageIds across an entire intelligence object.
 * Strips invalid IDs from every insight without removing the insight itself.
 * An insight with ZERO valid IDs after stripping is still kept (just without receipts).
 * @param {Object} intelligence — AfterchatIntelligence
 * @param {Map<string, Object>} messageIndex
 * @returns {Object} — cleaned intelligence
 */
export function validateIntelligenceEvidence(intelligence, messageIndex) {
  const clean = obj => {
    if (Array.isArray(obj)) return obj.map(clean);
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(obj)) {
        if (key === 'evidenceMessageIds') {
          result[key] = validateMessageIds(val, messageIndex);
        } else {
          result[key] = clean(val);
        }
      }
      return result;
    }
    return obj;
  };

  return clean(intelligence);
}

// ─── Phase 3 V2 — Evidence Store ──────────────────────────────────────────────

/**
 * Build the canonical evidence store from all chunk extractions.
 *
 * Takes every ChunkEvidence[] result, flattens the evidence[] arrays,
 * deduplicates by messageId (keeping highest importance), validates each
 * messageId against the real message index, and sorts by importance descending.
 *
 * Only items with importance >= 0.4 are kept (lower items are junk by spec).
 *
 * @param {Array} extractions   — ChunkEvidence[] from the extraction phase
 * @param {Map}   messageIndex  — built by buildMessageIndex()
 * @returns {Array}             — validated EvidenceItem[], sorted by importance desc
 */
export function buildEvidenceStore(extractions, messageIndex) {
  // Flatten all evidence items from all chunks
  const allItems = extractions.flatMap(e => e.evidence || []);

  // Deduplicate by messageId.
  // When the same message appears in multiple chunks:
  //   - Keep the version with the highest importance.
  //   - Prefer a richer connection string (longer = more analytical context).
  const byId = new Map();
  for (const item of allItems) {
    if (!item?.messageId || typeof item.messageId !== 'string') continue;
    const existing = byId.get(item.messageId);
    if (!existing) {
      byId.set(item.messageId, item);
    } else {
      const higherImportance = (item.importance ?? 0) > (existing.importance ?? 0);
      const richerConnection =
        (item.importance ?? 0) >= (existing.importance ?? 0) &&
        (item.connection || '').length > (existing.connection || '').length;
      if (higherImportance || richerConnection) {
        byId.set(item.messageId, {
          ...existing,
          importance: Math.max(existing.importance ?? 0, item.importance ?? 0),
          connection:
            (item.connection || '').length > (existing.connection || '').length
              ? item.connection
              : existing.connection,
        });
      }
    }
  }

  // Validate + enrich each item from the canonical messageIndex
  const validated = [];
  let invalidIdCount = 0;

  for (const item of byId.values()) {
    // 1. Verify messageId exists in the real source conversation
    if (!messageIndex.has(item.messageId)) {
      invalidIdCount++;
      continue;
    }

    // 2. Must meet importance threshold (0.4+)
    if ((item.importance ?? 0) < 0.4) continue;

    // 3. Retrieve the real message from source conversation (canonical truth)
    const realMsg = messageIndex.get(item.messageId);

    // 4. Construct canonical evidence item (exact text directly from source dataset)
    validated.push({
      messageId: item.messageId,
      type: item.type || 'other',
      original_type: item.original_type,
      importance: item.importance,
      connection: item.connection || (item.potentialConnections && item.potentialConnections[0]) || '',
      sender: realMsg.sender || 'Unknown',
      timestamp: realMsg.timestamp || '',
      text: realMsg.text || '', // EXACT original message text directly from conversation
      tags: item.tags || [],
    });
  }

  if (invalidIdCount > 0) {
    console.warn(`[Evidence] Stripped ${invalidIdCount} evidence items with invalid messageIds.`);
  }

  // Sort by importance descending
  validated.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));

  console.log(
    `[Evidence] Store built: ${validated.length} items from ${extractions.length} chunks ` +
    `(${invalidIdCount} invalid IDs stripped).`
  );

  return validated;
}

/**
 * Validate an existing evidence store against the message index.
 * Strips items with invalid messageIds and replaces text with canonical original.
 * Safe to call multiple times (idempotent).
 *
 * @param {Array} evidenceItems  — EvidenceItem[]
 * @param {Map}   messageIndex   — built by buildMessageIndex()
 * @returns {Array}              — cleaned EvidenceItem[]
 */
export function validateEvidenceStore(evidenceItems, messageIndex) {
  if (!Array.isArray(evidenceItems)) return [];

  return evidenceItems
    .filter(item => {
      if (!item?.messageId || !messageIndex.has(item.messageId)) return false;
      return true;
    })
    .map(item => {
      const realMsg = messageIndex.get(item.messageId);
      return {
        ...item,
        // Canonical text always comes from the original message
        text:      realMsg.text      ?? item.text,
        sender:    realMsg.sender    ?? item.sender,
        timestamp: realMsg.timestamp ?? item.timestamp,
      };
    });
}

export const MAX_EVIDENCE_PER_CHUNK = 20;

const ALLOWED_EXTRACTION_TYPES = new Set([
  'affection',
  'love',
  'flirting',
  'rejection',
  'conflict',
  'apology',
  'vulnerability',
  'promise',
  'contradiction',
  'behavior',
  'turning_point',
  'relationship_signal',
  'personality_signal',
  'event',
  'plan',
  'inside_joke',
  'callback_candidate',
  'foreshadowing_candidate',
  'funny',
  'dramatic',
  'memorable',
  'self_description',
  'other_description',
  'recurring_language',
  'recurring_topic',
  'emotional_texture_shift',
  'mood_shift',
  'other',
]);

export function normalizeEvidenceType(type) {
  const raw = typeof type === 'string' ? type : '';
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (ALLOWED_EXTRACTION_TYPES.has(normalized)) {
    return {
      type: normalized,
      originalType: raw,
      normalized: normalized !== raw,
      unknown: false,
    };
  }
  return {
    type: 'other',
    originalType: raw,
    normalized: true,
    unknown: Boolean(raw),
  };
}

export function normalizeExtractionResult(result, chunkId = '') {
  const rawEvidence = Array.isArray(result?.evidence) ? result.evidence : [];
  const normalizedEvidence = rawEvidence
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const normalizedType = normalizeEvidenceType(item.type);
      const normalized = {
        ...item,
        type: normalizedType.type,
      };
      if (normalizedType.normalized || normalizedType.unknown) {
        normalized.original_type = normalizedType.originalType;
      }
      return normalized;
    });

  const unknownTypeNormalizations = normalizedEvidence.filter(item =>
    item.original_type &&
    normalizeEvidenceType(item.original_type).type !== item.type
  ).length;
  const dedupedEvidence = deduplicateEvidence(normalizedEvidence);
  const rankedEvidence = rankEvidence(dedupedEvidence);
  const retainedEvidence = rankedEvidence.slice(0, MAX_EVIDENCE_PER_CHUNK);
  const discardedAfterRanking = Math.max(0, rankedEvidence.length - retainedEvidence.length);

  // Sanitize and clamp topics and recurringThemes to avoid schema rejection
  const safeTopics = Array.isArray(result?.topics)
    ? result.topics
        .filter(t => typeof t === 'string' && t.trim())
        .map(t => t.trim())
        .slice(0, 15)
    : [];

  const safeThemes = Array.isArray(result?.recurringThemes)
    ? result.recurringThemes
        .filter(t => typeof t === 'string' && t.trim())
        .map(t => t.trim())
        .slice(0, 10)
    : [];

  const stats = {
    rawEvidenceItems: rawEvidence.length,
    deduplicatedEvidenceItems: dedupedEvidence.length,
    rankedEvidenceItems: rankedEvidence.length,
    retainedEvidenceItems: retainedEvidence.length,
    discardedAfterRanking,
    evidenceOverflowEvents: rawEvidence.length > MAX_EVIDENCE_PER_CHUNK ? 1 : 0,
    unknownEvidenceTypesNormalized: unknownTypeNormalizations,
  };

  if (process.env.NODE_ENV !== 'production' && rawEvidence.length !== retainedEvidence.length) {
    console.log(
      `[Extraction] ${chunkId || 'chunk'}: raw evidence: ${rawEvidence.length}, ` +
      `deduplicated: ${dedupedEvidence.length}, ranked: ${rankedEvidence.length}, ` +
      `retained: ${retainedEvidence.length}`
    );
  }

  return {
    ...result,
    topics: safeTopics,
    recurringThemes: safeThemes,
    evidence: retainedEvidence,
    _normalization: stats,
  };
}

function deduplicateEvidence(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = evidenceKey(item);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || evidenceScore(item) > evidenceScore(existing)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

function evidenceKey(item) {
  const messageId = item.messageId || item.message_id;
  if (messageId) return `id:${messageId}`;

  const receiptId = item.receiptId || item.receipt_id;
  if (receiptId) return `receipt:${receiptId}`;

  const text = String(item.message_text || item.text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return [
    item.timestamp || '',
    item.sender || '',
    text,
  ].join('|');
}

function rankEvidence(items) {
  return [...items].sort((a, b) => {
    const scoreDiff = evidenceScore(b) - evidenceScore(a);
    if (scoreDiff !== 0) return scoreDiff;

    const aTime = Date.parse(a.timestamp || '') || 0;
    const bTime = Date.parse(b.timestamp || '') || 0;
    return aTime - bTime;
  });
}

function evidenceScore(item) {
  const typePriority = {
    callback_candidate: 100,
    turning_point: 98,
    contradiction: 96,
    conflict: 94,
    rejection: 92,
    affection: 90,
    love: 88,
    flirting: 86,
    apology: 84,
    vulnerability: 82,
    relationship_signal: 80,
    personality_signal: 78,
    event: 76,
    plan: 74,
    inside_joke: 72,
    funny: 70,
    dramatic: 68,
    memorable: 66,
    promise: 64,
    foreshadowing_candidate: 62,
    self_description: 60,
    other_description: 58,
    recurring_language: 75,
    recurring_topic: 75,
    emotional_texture_shift: 85,
    mood_shift: 85,
    behavior: 30,
    other: 10,
  };
  const importance = Number(item.importance ?? item.confidence ?? item.relevance ?? 0);
  return (typePriority[item.type] ?? 10) * 1000 + Math.max(0, Math.min(1, importance)) * 100;
}

/**
 * Validate extraction output against the exact source messages in one chunk.
 * Keeps valid evidence, rejects invalid IDs/types, and never fabricates replacements.
 *
 * @param {Object} extraction
 * @param {Object} chunk
 * @returns {{ extraction: Object, stats: Object }}
 */
export function validateChunkExtractionEvidence(extraction, chunk) {
  // Build a fast lookup of message IDs that actually exist in THIS chunk.
  // This is the ONLY validation this function performs — normalizeExtractionResult
  // already handled importance filtering, deduplication, and type normalization.
  // Re-doing those here would silently discard valid evidence a second time.
  const chunkMessageIds = new Set(
    (chunk.messages || [])
      .filter(m => m.type === 'message')
      .map(m => m.id)
  );

  const rawItems = Array.isArray(extraction?.evidence) ? extraction.evidence : [];
  const validEvidence = [];
  const invalidIds = [];

  for (const item of rawItems) {
    if (!item?.messageId || !chunkMessageIds.has(item.messageId)) {
      invalidIds.push(item?.messageId || '(missing)');
      continue;
    }
    // Pass through as-is — type normalization already done upstream
    validEvidence.push(item);
  }

  if (invalidIds.length > 0) {
    console.log(
      `[Evidence] ${chunk.id || 'chunk'}: ${validEvidence.length}/${rawItems.length} valid ` +
      `(${invalidIds.length} invalid IDs stripped: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''})`
    );
  }

  return {
    extraction: {
      ...extraction,
      evidence: validEvidence,
    },
    stats: {
      rawEvidenceItems: rawItems.length,
      validEvidenceItems: validEvidence.length,
      rejectedEvidenceItems: invalidIds.length,
      schemaNormalizationEvents: validEvidence.filter(item => item.original_type).length,
      unknownEvidenceTypesNormalized: validEvidence.filter(
        item => item.type === 'other' &&
          item.original_type &&
          item.original_type.trim().toLowerCase().replace(/[\s-]+/g, '_') !== 'other'
      ).length,
    },
  };
}

// Type priority buckets for balanced evidence selection.
// Ensures emotionally significant types always have representation even
// when the store is dominated by recurring_language / behavior items.
const EVIDENCE_TYPE_PRIORITY_BUCKETS = [
  // Tier 1 — narrative anchors (turning points, conflicts, rejections)
  new Set(['turning_point', 'conflict', 'rejection', 'apology', 'contradiction']),
  // Tier 2 — emotional texture (the moments that make eras feel real)
  new Set(['emotional_texture_shift', 'mood_shift', 'vulnerability', 'affection', 'love', 'flirting']),
  // Tier 3 — pattern/relationship signals
  new Set(['relationship_signal', 'callback_candidate', 'inside_joke', 'promise', 'foreshadowing_candidate']),
  // Tier 4 — personality and topic anchors
  new Set(['personality_signal', 'self_description', 'other_description', 'recurring_language', 'recurring_topic']),
  // Tier 5 — entertaining moments
  new Set(['funny', 'dramatic', 'memorable', 'event', 'plan', 'behavior', 'other']),
];

/**
 * Format the evidence store for inclusion in the investigator prompt.
 *
 * Selection strategy (120 items max):
 *   1. Type-balanced pass: walk through priority buckets, take top items from each
 *      so high-importance recurring_language doesn't crowd out turning_points.
 *   2. Fill remaining slots with highest-importance unseen items.
 *   3. Sort chronologically — eras need timeline context, not ranked lists.
 *   4. Truncate long message text to 200 chars so one verbose message
 *      can't crowd out dozens of shorter ones.
 *
 * @param {Array} evidenceStore - EvidenceItem[] sorted by importance desc
 * @param {number} [maxItems=120]
 * @returns {string}
 */
export function formatEvidenceForPrompt(evidenceStore, maxItems = 120) {
  if (!Array.isArray(evidenceStore) || evidenceStore.length === 0) {
    return 'No evidence items available.';
  }

  const selected = [];
  const seenIds = new Set();

  // Phase 1 — type-balanced bucket pass
  // Give each bucket a proportional slot count, take the highest-importance items.
  const slotsPerBucket = Math.floor(maxItems * 0.7 / EVIDENCE_TYPE_PRIORITY_BUCKETS.length);
  for (const bucket of EVIDENCE_TYPE_PRIORITY_BUCKETS) {
    let taken = 0;
    for (const item of evidenceStore) {
      if (taken >= slotsPerBucket) break;
      if (seenIds.has(item.messageId)) continue;
      if (bucket.has(item.type)) {
        selected.push(item);
        seenIds.add(item.messageId);
        taken++;
      }
    }
  }

  // Phase 2 — fill remaining slots with highest-importance unseen items
  for (const item of evidenceStore) {
    if (selected.length >= maxItems) break;
    if (!seenIds.has(item.messageId)) {
      selected.push(item);
      seenIds.add(item.messageId);
    }
  }

  // Sort chronologically — the investigator needs timeline context, not ranked lists
  const chronological = [...selected].sort(
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
  );

  const typeCounts = {};
  for (const item of chronological) {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  }
  const typeBreakdown = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t}:${n}`)
    .join(', ');
  console.log(`[Evidence] Prompt selection: ${chronological.length} items (${typeBreakdown})`);

  return chronological.map(item => {
    const ts = item.timestamp ? item.timestamp.replace('T', ' ').slice(0, 16) : 'unknown date';
    // Truncate long message text — 200 chars is enough for the investigator to
    // recognise the moment without one verbose message crowding out many others.
    const rawText = String(item.text || '');
    const displayText = rawText.length > 200 ? rawText.slice(0, 200) + '…' : rawText;
    const lines = [
      `[${item.messageId}] ${ts} | ${item.sender || 'Unknown'} (${item.type}, imp=${item.importance})`,
      `  "${displayText}"`,
    ];
    if (item.connection) {
      lines.push(`  → ${item.connection}`);
    }
    return lines.join('\n');
  }).join('\n\n');
}

function safeArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') return Object.values(val);
  return [];
}

/**
 * Validates all evidence references inside a RelationshipInvestigator result.
 *
 * @param {Object} result - RelationshipInvestigator result
 * @param {Map} messageIndex - map of real messages by id
 * @returns {{ validatedResult: Object, validCount: number, strippedCount: number }}
 */
export function validateInvestigatorRefs(result, messageIndex) {
  if (!result || typeof result !== 'object') {
    return { validatedResult: result || {}, validCount: 0, strippedCount: 0 };
  }

  let validCount = 0;
  let strippedCount = 0;

  function cleanRef(ref) {
    if (!ref) return null;
    const msgId = typeof ref === 'string' ? ref : ref.messageId;
    if (!msgId || typeof msgId !== 'string' || !messageIndex.has(msgId)) {
      strippedCount++;
      return null;
    }
    validCount++;
    const realMsg = messageIndex.get(msgId);
    return {
      messageId: msgId,
      timestamp: realMsg.timestamp || ref.timestamp || '',
      exactText: realMsg.text ?? ref.exactText ?? '',
    };
  }

  function cleanRefList(list) {
    return safeArray(list).map(cleanRef).filter(Boolean);
  }

  const cleaned = {
    ...result,
    eras: safeArray(result.eras).map((era, idx) => ({
      ...era,
      id: era.id || `era_${idx + 1}`,
      evidence: cleanRefList(era.evidence),
    })),
    participantProfiles: safeArray(result.participantProfiles).map((p) => ({
      ...p,
      selfImage: safeArray(p.selfImage).map((si) => ({
        ...si,
        evidence: cleanRefList(si.evidence),
      })),
      observedBehavior: safeArray(p.observedBehavior).map((ob) => ({
        ...ob,
        evidence: cleanRefList(ob.evidence),
      })),
    })),
    patterns: safeArray(result.patterns).map((pat, idx) => ({
      ...pat,
      id: pat.id || `pattern_${idx + 1}`,
      evidence: cleanRefList(pat.evidence),
    })).filter((pat) => pat.evidence.length > 0),
    contradictions: safeArray(result.contradictions).map((c) => ({
      ...c,
      evidence: cleanRefList(c.evidence),
    })).filter((c) => c.evidence.length > 0),
    callbacks: safeArray(result.callbacks).map((cb) => {
      const earlier = cleanRef(cb.earlier);
      const later = cleanRef(cb.later);
      if (!earlier || !later) return null;
      return { ...cb, earlier, later };
    }).filter(Boolean),
    foreshadowing: safeArray(result.foreshadowing).map((fs) => {
      const setup = cleanRef(fs.setup);
      const payoff = cleanRef(fs.payoff);
      if (!setup || !payoff) return null;
      return { ...fs, setup, payoff };
    }).filter(Boolean),
    lore: safeArray(result.lore).map((l, idx) => ({
      ...l,
      id: l.id || `lore_${idx + 1}`,
      evidence: cleanRefList(l.evidence),
    })),
    funnyMoments: safeArray(result.funnyMoments).map((fm) => ({
      ...fm,
      evidence: cleanRefList(fm.evidence),
    })),
    turningPoints: safeArray(result.turningPoints).map((tp) => ({
      ...tp,
      evidence: cleanRefList(tp.evidence),
    })),
    plotTwists: safeArray(result.plotTwists).map((pt, idx) => ({
      ...pt,
      id: pt.id || `twist_${idx + 1}`,
      evidence: cleanRefList(pt.evidence),
    })),
    receiptCandidates: safeArray(result.receiptCandidates).map((rc) => {
      if (!rc || !rc.messageId || !messageIndex.has(rc.messageId)) {
        strippedCount++;
        return null;
      }
      validCount++;
      const realMsg = messageIndex.get(rc.messageId);
      return {
        ...rc,
        timestamp: realMsg.timestamp || rc.timestamp || '',
        exactText: realMsg.text ?? rc.exactText ?? '',
        sender: rc.sender || realMsg.sender || 'Unknown',
      };
    }).filter(Boolean),
    unresolvedThreads: safeArray(result.unresolvedThreads).map((ut) => ({
      ...ut,
      evidence: cleanRefList(ut.evidence),
    })),
    storyInsights: safeArray(result.storyInsights).map((si) => ({
      ...si,
      evidence: cleanRefList(si.evidence),
    })),
  };

  return { validatedResult: cleaned, validCount, strippedCount };
}
