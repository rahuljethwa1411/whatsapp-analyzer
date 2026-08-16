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

  // Deduplicate by messageId — keep highest importance version
  const byId = new Map();
  for (const item of allItems) {
    if (!item?.messageId || typeof item.messageId !== 'string') continue;
    const existing = byId.get(item.messageId);
    if (!existing || (item.importance ?? 0) > (existing.importance ?? 0)) {
      byId.set(item.messageId, item);
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

/**
 * Validate extraction output against the exact source messages in one chunk.
 * Keeps valid evidence, rejects invalid IDs/types, and never fabricates replacements.
 *
 * @param {Object} extraction
 * @param {Object} chunk
 * @returns {{ extraction: Object, stats: Object }}
 */
export function validateChunkExtractionEvidence(extraction, chunk) {
  const chunkMessageMap = new Map(
    (chunk.messages || [])
      .filter(m => m.type === 'message')
      .map(m => [m.id, m])
  );
  const rawItems = Array.isArray(extraction?.evidence) ? extraction.evidence : [];
  const validEvidence = [];
  const seen = new Set();
  const rejections = [];

  for (const item of rawItems.slice(0, 20)) {
    if (!item?.messageId || !chunkMessageMap.has(item.messageId)) {
      rejections.push({ reason: 'invalid_message_id', messageId: item?.messageId || '' });
      continue;
    }

    const normalizedType = normalizeEvidenceType(item.type);

    if ((item.importance ?? 0) < 0.4) {
      rejections.push({ reason: 'low_importance', messageId: item.messageId, importance: item.importance ?? null });
      continue;
    }

    if (seen.has(item.messageId)) {
      rejections.push({ reason: 'duplicate_message_id', messageId: item.messageId });
      continue;
    }

    seen.add(item.messageId);
    const validItem = {
      messageId: item.messageId,
      type: normalizedType.type,
      importance: item.importance,
      connection: item.connection || '',
    };
    if (normalizedType.unknown || normalizedType.normalized) {
      validItem.original_type = normalizedType.originalType;
    }
    validEvidence.push(validItem);
  }

  if (rawItems.length > 20) {
    rejections.push({ reason: 'over_max_evidence_items', count: rawItems.length - 20 });
  }

  if (rejections.length > 0) {
    console.warn(
      `[Evidence] ${chunk.id}: rejected ${rejections.length} invalid extraction evidence item(s). ` +
      rejections.map(r => `${r.reason}${r.messageId ? `:${r.messageId}` : ''}`).join(', ')
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
      rejectedEvidenceItems: rejections.length,
      schemaNormalizationEvents: validEvidence.filter(item => item.original_type).length,
      unknownEvidenceTypesNormalized: validEvidence.filter(item => item.type === 'other' && item.original_type && item.original_type.trim().toLowerCase().replace(/[\s-]+/g, '_') !== 'other').length,
      rejections,
    },
  };
}

/**
 * Format the evidence store for inclusion in the investigator prompt.
 * Selects up to maxItems and formats them in chronological order.
 *
 * @param {Array} evidenceStore - EvidenceItem[]
 * @param {number} [maxItems=80]
 * @returns {string}
 */
export function formatEvidenceForPrompt(evidenceStore, maxItems = 80) {
  if (!Array.isArray(evidenceStore) || evidenceStore.length === 0) {
    return 'No evidence items available.';
  }

  // Take top maxItems by importance
  const selected = evidenceStore.slice(0, maxItems);

  // Sort chronologically for timeline understanding
  const chronological = [...selected].sort((a, b) => {
    return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
  });

  return chronological.map(item => {
    const ts = item.timestamp ? item.timestamp.replace('T', ' ').slice(0, 16) : 'unknown date';
    const lines = [
      `[${item.messageId}] ${ts} | ${item.sender || 'Unknown'} (${item.type}, imp=${item.importance})`,
      `  "${item.text}"`,
    ];
    if (item.potentialConnections && item.potentialConnections.length > 0) {
      lines.push(`  → connection hint: ${item.potentialConnections.join(' | ')}`);
    }
    return lines.join('\n');
  }).join('\n\n');
}

/**
 * Validate all evidence references within the RelationshipInvestigator result.
 * Strips invalid messageIds and replaces exactText with canonical message text.
 *
 * @param {Object} result - RelationshipInvestigator result
 * @param {Map} messageIndex - map of real messages by id
 * @returns {{ validatedResult: Object, validCount: number, strippedCount: number }}
 */
export function validateInvestigatorRefs(result, messageIndex) {
  if (!result || typeof result !== 'object') {
    return { validatedResult: result, validCount: 0, strippedCount: 0 };
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
    if (!Array.isArray(list)) return [];
    return list.map(cleanRef).filter(Boolean);
  }

  const cleaned = {
    ...result,
    eras: (result.eras || []).map((era, idx) => ({
      ...era,
      id: era.id || `era_${idx + 1}`,
      evidence: cleanRefList(era.evidence),
    })),
    participantProfiles: (result.participantProfiles || []).map(p => ({
      ...p,
      selfImage: (p.selfImage || []).map(si => ({
        ...si,
        evidence: cleanRefList(si.evidence),
      })),
      observedBehavior: (p.observedBehavior || []).map(ob => ({
        ...ob,
        evidence: cleanRefList(ob.evidence),
      })),
    })),
    patterns: (result.patterns || []).map((pat, idx) => ({
      ...pat,
      id: pat.id || `pattern_${idx + 1}`,
      evidence: cleanRefList(pat.evidence),
    })).filter(pat => pat.evidence.length > 0),
    contradictions: (result.contradictions || []).map(c => ({
      ...c,
      evidence: cleanRefList(c.evidence),
    })).filter(c => c.evidence.length > 0),
    callbacks: (result.callbacks || []).map(cb => {
      const earlier = cleanRef(cb.earlier);
      const later = cleanRef(cb.later);
      if (!earlier || !later) return null;
      return { ...cb, earlier, later };
    }).filter(Boolean),
    foreshadowing: (result.foreshadowing || []).map(fs => {
      const setup = cleanRef(fs.setup);
      const payoff = cleanRef(fs.payoff);
      if (!setup || !payoff) return null;
      return { ...fs, setup, payoff };
    }).filter(Boolean),
    lore: (result.lore || []).map((l, idx) => ({
      ...l,
      id: l.id || `lore_${idx + 1}`,
      evidence: cleanRefList(l.evidence),
    })),
    funnyMoments: (result.funnyMoments || []).map(fm => ({
      ...fm,
      evidence: cleanRefList(fm.evidence),
    })),
    turningPoints: (result.turningPoints || []).map(tp => ({
      ...tp,
      evidence: cleanRefList(tp.evidence),
    })),
    plotTwists: (result.plotTwists || []).map((pt, idx) => ({
      ...pt,
      id: pt.id || `twist_${idx + 1}`,
      evidence: cleanRefList(pt.evidence),
    })),
    receiptCandidates: (result.receiptCandidates || []).map(rc => {
      if (!rc.messageId || !messageIndex.has(rc.messageId)) {
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
    unresolvedThreads: (result.unresolvedThreads || []).map(ut => ({
      ...ut,
      evidence: cleanRefList(ut.evidence),
    })),
    storyInsights: (result.storyInsights || []).map(si => ({
      ...si,
      evidence: cleanRefList(si.evidence),
    })),
  };

  return { validatedResult: cleaned, validCount, strippedCount };
}
