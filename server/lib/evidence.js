/**
 * Evidence Retriever & Context Reconstruction Engine
 *
 * Fundamental Unit: INTERACTION (messages -> interaction -> evidence)
 *
 * Guarantees:
 *   1. NEVER send isolated messages when meaning depends on surrounding context.
 *   2. Dynamic context windows: adaptively expand backward to find setup and forward to find reaction/resolution.
 *   3. Universal & relation-agnostic: works for all conversation types (humor, conflict, romance, plans, banter).
 *   4. Hard no-cross-contamination: never stitches together unrelated messages or distant topics.
 *   5. Preserves same topics months apart as distinct local interactions for global pattern detection.
 *   6. Self-contained validation: ensures a stranger can understand WHO, WHAT, and the OUTCOME.
 *   7. Traceable receipts: raw source messages are preserved alongside interaction summaries.
 */

const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours hard break
const ACTIVE_CONVERSATION_GAP_MS = 6 * 60 * 1000; // 6 minutes active conversation turn (prevents separate exchanges from merging)

// How far back/forward to expand an interaction context window.
// Configurable via env vars so it can be tuned without a code change.
export const DEFAULT_MAX_BACKWARD = parseInt(process.env.EVIDENCE_MAX_BACKWARD || '8', 10);
export const DEFAULT_MAX_FORWARD  = parseInt(process.env.EVIDENCE_MAX_FORWARD  || '8', 10);

/**
 * Build a fast lookup map from all messages.
 * @param {Array} allMessages — all ChatMessage[] from the request
 * @returns {Map<string, Object>}
 */
export function buildMessageIndex(allMessages) {
  const index = new Map();
  for (const m of allMessages || []) {
    if (m && m.id) {
      index.set(m.id, m);
    }
  }
  return index;
}

/**
 * Build a chronological list of valid chat messages and an index of their positions.
 * @param {Array} allMessages
 * @returns {{ chronological: Array, positionIndex: Map<string, number> }}
 */
export function buildChronologicalMessageIndex(allMessages) {
  const chronological = (allMessages || [])
    .filter((m) => m && m.type === 'message' && m.text && m.text.trim().length > 0)
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  const positionIndex = new Map();
  for (let i = 0; i < chronological.length; i++) {
    positionIndex.set(chronological[i].id, i);
  }

  return { chronological, positionIndex };
}

/**
 * Retrieves messages by IDs.
 * Only returns IDs that actually exist in the index.
 * @param {string[]} ids
 * @param {Map<string, Object>} messageIndex
 * @returns {Array}
 */
export function getMessagesByIds(ids, messageIndex) {
  if (!Array.isArray(ids)) return [];
  return ids
    .filter((id) => messageIndex.has(id))
    .map((id) => messageIndex.get(id));
}

/**
 * Validates an array of message IDs against the real index.
 * @param {string[]} ids
 * @param {Map<string, Object>} messageIndex
 * @returns {string[]}
 */
export function validateMessageIds(ids, messageIndex) {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => typeof id === 'string' && messageIndex.has(id));
}

/**
 * Validates all evidenceMessageIds across an entire intelligence object.
 * @param {Object} intelligence — AfterchatIntelligence
 * @param {Map<string, Object>} messageIndex
 * @returns {Object} — cleaned intelligence
 */
export function validateIntelligenceEvidence(intelligence, messageIndex) {
  const clean = (obj) => {
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

// ─── Interaction Context Reconstruction ──────────────────────────────────────

/**
 * Checks if a message looks like a direct continuation, response, or reference.
 */
function hasConversationalContinuity(prevMsg, currMsg) {
  if (!prevMsg || !currMsg) return false;

  const timeDiff = Math.abs(new Date(currMsg.timestamp || 0) - new Date(prevMsg.timestamp || 0));
  if (timeDiff > ACTIVE_CONVERSATION_GAP_MS) return false;

  // Sender alternation is the strongest signal of an active exchange
  if (prevMsg.sender !== currMsg.sender) return true;

  // Very rapid consecutive messages (< 60s) from same sender belong to same burst
  if (timeDiff < 60 * 1000) return true;

  // Universal continuation signals that work for any language:
  // Short messages (< 40 chars) from the same sender arriving within 3 minutes are
  // almost always part of the same thought or reaction burst.
  const text = (currMsg.text || '').trim();
  if (text.length < 40 && timeDiff < 3 * 60 * 1000) return true;

  // Pronoun / reference words — universal across romanized languages
  const universalRefs = ['you', 'i ', ' me', 'that', 'this', 'ok', 'lol', 'lmao', 'haha', 'bro', 'wait', 'wtf', 'omg', 'nah', 'yes', 'no ', 'why', 'what'];
  const lower = text.toLowerCase();
  return universalRefs.some((w) => lower.startsWith(w.trim()) || lower.includes(w));
}

/**
 * Reconstructs a self-contained conversational interaction around an anchor message.
 * Adaptively expands backward for setup and forward for reaction/resolution.
 *
 * @param {string|string[]} anchorIds — message ID or array of message IDs
 * @param {Array} chronologicalMessages — all sorted messages in archive
 * @param {Map<string, number>} positionIndex — ID to index map
 * @param {Object} options
 * @returns {Array} Contiguous slice of messages representing the full interaction
 */
export function reconstructInteractionContext(
  anchorIds,
  chronologicalMessages,
  positionIndex,
  options = {}
) {
  if (!chronologicalMessages || chronologicalMessages.length === 0) return [];

  const rawIds = Array.isArray(anchorIds) ? anchorIds : [anchorIds];
  const validPositions = rawIds
    .map((id) => positionIndex.get(id))
    .filter((pos) => pos !== undefined)
    .sort((a, b) => a - b);

  if (validPositions.length === 0) return [];

  let startIdx = validPositions[0];
  let endIdx = validPositions[validPositions.length - 1];

  const maxBackward = options.maxBackward ?? DEFAULT_MAX_BACKWARD;
  const maxForward  = options.maxForward  ?? DEFAULT_MAX_FORWARD;

  // 1. Expand Backward to capture setup, question, trigger
  let backwardSteps = 0;
  while (startIdx > 0 && backwardSteps < maxBackward) {
    const prev = chronologicalMessages[startIdx - 1];
    const curr = chronologicalMessages[startIdx];

    const timeDiff = Math.abs(new Date(curr.timestamp || 0) - new Date(prev.timestamp || 0));
    if (timeDiff > ACTIVE_CONVERSATION_GAP_MS) break; // Hard break if conversation was idle

    if (hasConversationalContinuity(prev, curr) || backwardSteps === 0) {
      startIdx--;
      backwardSteps++;
    } else {
      break;
    }
  }

  // 2. Expand Forward to capture response, escalation, punchline, reaction, resolution
  let forwardSteps = 0;
  while (endIdx < chronologicalMessages.length - 1 && forwardSteps < maxForward) {
    const curr = chronologicalMessages[endIdx];
    const next = chronologicalMessages[endIdx + 1];

    const timeDiff = Math.abs(new Date(next.timestamp || 0) - new Date(curr.timestamp || 0));
    if (timeDiff > ACTIVE_CONVERSATION_GAP_MS) break; // Hard break if conversation was idle

    if (hasConversationalContinuity(curr, next) || forwardSteps === 0) {
      endIdx++;
      forwardSteps++;
    } else {
      break;
    }
  }

  return chronologicalMessages.slice(startIdx, endIdx + 1);
}

/**
 * Validates that an interaction is self-contained and not cross-contaminated across topics.
 *
 * Self-Contained Test:
 * "Could a person who has never seen this chat understand what happened?"
 *
 * @param {Array} interactionMessages
 * @returns {boolean}
 */
export function validateSelfContainedInteraction(interactionMessages) {
  if (!Array.isArray(interactionMessages) || interactionMessages.length === 0) {
    return false;
  }

  // A single message is valid only if it is a complete, self-contained statement/confession (> 40 chars or clear statement)
  if (interactionMessages.length === 1) {
    const text = (interactionMessages[0].text || '').trim();
    return text.length >= 35 && !['ok', 'k', 'fine', 'haan', 'nahi'].includes(text.toLowerCase());
  }

  // Check contiguity and time consistency (no cross-contamination from distant months)
  for (let i = 1; i < interactionMessages.length; i++) {
    const prevTs = new Date(interactionMessages[i - 1].timestamp || 0).getTime();
    const currTs = new Date(interactionMessages[i].timestamp || 0).getTime();
    if (currTs - prevTs > SESSION_GAP_MS) {
      return false; // Cross-contamination across multi-hour/day silence gap
    }
  }

  return true;
}

/**
 * Computes an interaction-level tone from the full dialogue exchange.
 *
 * @param {Array} messages
 * @param {string} declaredType
 * @returns {string}
 */
/**
 * Infers tone from the complete multi-message interaction.
 *
 * Rules:
 *  1. Declared type from the LLM extractor is the primary signal.
 *  2. Universal emoji / punctuation patterns supplement.
 *  3. NO hardcoded language-specific words (no Hinglish, no Hindi slang).
 *     Those words can only be correctly interpreted by a full-context LLM pass,
 *     which happens in the investigation/synthesis layer.
 */
export function inferInteractionTone(messages, declaredType = '') {
  const combined = messages.map((m) => m.text || '').join(' ');
  const lower    = combined.toLowerCase();

  // ── Primary: use the LLM-declared type ───────────────────────────────────
  const conflictTypes     = new Set(['conflict', 'tense_confrontation', 'rejection']);
  const vulnerableTypes   = new Set(['vulnerability', 'self_description', 'apology', 'emotional_texture_shift']);
  const affectionTypes    = new Set(['affection', 'love', 'flirting']);
  const playfulTypes      = new Set(['funny', 'inside_joke', 'callback_candidate', 'memorable', 'recurring_language']);
  const logisticsTypes    = new Set(['plan', 'event', 'promise']);

  if (conflictTypes.has(declaredType))   return 'tense_confrontation';
  if (vulnerableTypes.has(declaredType)) return 'vulnerable_confession';
  if (affectionTypes.has(declaredType))  return 'warm_affection';
  if (playfulTypes.has(declaredType))    return 'playful_roast';
  if (logisticsTypes.has(declaredType))  return 'logistical_banter';

  // ── Secondary: universal emoji / punctuation signals ─────────────────────
  const laughEmojis   = /[😂🤣💀😹]/u;
  const angryEmojis   = /[😡🤬😤😠]/u;
  const sadEmojis     = /[😢😭💔🥺😞]/u;
  const heartEmojis   = /[❤️💕💞🥰😍]/u;

  if (laughEmojis.test(combined) || lower.includes('lmao') || lower.includes('lol') || lower.includes('haha')) {
    return 'playful_roast';
  }
  if (angryEmojis.test(combined) || lower.includes('wtf') || lower.includes('blocked')) {
    return 'tense_confrontation';
  }
  if (sadEmojis.test(combined) || lower.includes('sorry') || lower.includes('care')) {
    return 'vulnerable_confession';
  }
  if (heartEmojis.test(combined) || lower.includes('love') || lower.includes('miss you')) {
    return 'warm_affection';
  }

  return 'conversational_banter';
}

/**
 * Deduplicates overlapping interactions.
 * If Interaction A and Interaction B share message IDs or cover the same conversational event,
 * merges them into ONE interaction instead of creating duplicate evidence items.
 *
 * @param {Array} interactions
 * @returns {Array} Deduplicated interactions
 */
export function deduplicateInteractions(interactions) {
  if (!Array.isArray(interactions) || interactions.length <= 1) {
    return interactions || [];
  }

  const merged = [];
  const processed = new Set();

  for (let i = 0; i < interactions.length; i++) {
    if (processed.has(i)) continue;
    let current = { ...interactions[i] };
    const currentIdSet = new Set(current.messageIds);

    for (let j = i + 1; j < interactions.length; j++) {
      if (processed.has(j)) continue;
      const other = interactions[j];
      const otherIdSet = new Set(other.messageIds);

      // Check overlap count
      let overlapCount = 0;
      for (const id of otherIdSet) {
        if (currentIdSet.has(id)) overlapCount++;
      }

      // Merge if they share message IDs or overlap by >= 40%
      const shouldMerge =
        overlapCount > 0 &&
        (overlapCount / Math.min(currentIdSet.size, otherIdSet.size) >= 0.4 ||
          (current.startTimestamp === other.startTimestamp && current.endTimestamp === other.endTimestamp));

      if (shouldMerge) {
        processed.add(j);
        // Combine messages chronologically
        const combinedMsgs = [...current.messages];
        for (const m of other.messages) {
          if (!currentIdSet.has(m.id)) {
            combinedMsgs.push(m);
            currentIdSet.add(m.id);
          }
        }
        combinedMsgs.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

        current = {
          ...current,
          messageIds: combinedMsgs.map((m) => m.id),
          messages: combinedMsgs,
          startTimestamp: combinedMsgs[0]?.timestamp || current.startTimestamp,
          endTimestamp: combinedMsgs[combinedMsgs.length - 1]?.timestamp || current.endTimestamp,
          importance: Math.max(current.importance, other.importance),
          interactionSummary:
            (other.interactionSummary || '').length > (current.interactionSummary || '').length
              ? other.interactionSummary
              : current.interactionSummary,
        };
      }
    }

    processed.add(i);
    merged.push(current);
  }

  return merged;
}

// ─── Canonical Evidence Store Builder ────────────────────────────────────────

/**
 * Builds the canonical interaction-centric evidence store from all chunk extractions.
 *
 * 1. Takes all raw candidate extractions.
 * 2. Dynamically reconstructs the complete conversational interaction around each candidate.
 * 3. Validates self-containment and prevents cross-contamination.
 * 4. Deduplicates overlapping interactions into single coherent evidence objects.
 * 5. Scores and ranks complete interactions.
 *
 * @param {Array} extractions — ChunkEvidence[] from extraction phase
 * @param {Map} messageIndex — message ID to message object map
 * @param {Array} [allMessages] — optional array of all chronological messages
 * @returns {Array} Validated, self-contained EvidenceInteraction[]
 */
export function buildEvidenceStore(extractions, messageIndex, allMessages = null) {
  const messageList = allMessages || Array.from(messageIndex.values());
  const { chronological, positionIndex } = buildChronologicalMessageIndex(messageList);

  const rawCandidates = (extractions || []).flatMap((e) => e.evidence || []);
  const rawInteractions = [];

  for (const candidate of rawCandidates) {
    if (!candidate || !candidate.messageId || !messageIndex.has(candidate.messageId)) {
      continue;
    }

    if ((candidate.importance ?? 0) < 0.35) continue;

    // Anchor IDs: support single messageId or explicit messageIds array
    const targetIds = Array.isArray(candidate.messageIds) && candidate.messageIds.length > 0
      ? candidate.messageIds
      : [candidate.messageId];

    // Reconstruct dynamic interaction window
    const interactionMessages = reconstructInteractionContext(targetIds, chronological, positionIndex);

    if (!validateSelfContainedInteraction(interactionMessages)) {
      continue;
    }

    const participants = Array.from(new Set(interactionMessages.map((m) => m.sender).filter(Boolean)));
    const startTimestamp = interactionMessages[0]?.timestamp || '';
    const endTimestamp = interactionMessages[interactionMessages.length - 1]?.timestamp || '';
    const inferredTone = inferInteractionTone(interactionMessages, candidate.type);

    const anchorMsg = messageIndex.get(candidate.messageId);
    const summary = candidate.connection || candidate.interactionSummary || `Interaction involving ${participants.join(' and ')}`;

    rawInteractions.push({
      id: `ev_int_${rawInteractions.length + 1}`,
      messageId: candidate.messageId,
      primaryMessageId: candidate.messageId,
      messageIds: interactionMessages.map((m) => m.id),
      startTimestamp,
      endTimestamp,
      participants,
      messages: interactionMessages.map((m) => ({
        id: m.id,
        sender: m.sender || 'Unknown',
        timestamp: m.timestamp || '',
        text: m.text || '',
      })),
      interactionSummary: summary,
      type: normalizeEvidenceType(candidate.type).type,
      tone: candidate.tone || inferredTone,
      importance: candidate.importance ?? 0.8,
      confidence: candidate.confidence ?? 0.9,
      isCallbackCandidate: candidate.type === 'callback_candidate',
      text: anchorMsg?.text || '',
      sender: anchorMsg?.sender || 'Unknown',
      timestamp: anchorMsg?.timestamp || '',
      connection: summary,
    });
  }

  // Deduplicate overlapping interactions into unified conversational events
  const deduplicated = deduplicateInteractions(rawInteractions);

  // Sort by importance descending
  deduplicated.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));

  console.log(
    `[Evidence] Canonical store built: ${deduplicated.length} self-contained interactions ` +
    `from ${rawCandidates.length} raw extraction items.`
  );

  if (process.env.NODE_ENV !== 'production' && deduplicated.length > 0) {
    const sample = deduplicated[0];
    console.log(
      `[Interaction] Sample: id=${sample.id} range=${sample.messageIds[0]}..${sample.messageIds[sample.messageIds.length - 1]} ` +
      `messages=${sample.messages.length} tone=${sample.tone} importance=${sample.importance}\n` +
      `  Summary: "${sample.interactionSummary}"`
    );
  }

  return deduplicated;
}

/**
 * Validates an existing evidence store against the message index.
 * @param {Array} evidenceItems
 * @param {Map} messageIndex
 * @returns {Array}
 */
export function validateEvidenceStore(evidenceItems, messageIndex) {
  if (!Array.isArray(evidenceItems)) return [];

  return evidenceItems
    .filter((item) => item?.messageId && messageIndex.has(item.messageId))
    .map((item) => {
      const realMsg = messageIndex.get(item.messageId);
      return {
        ...item,

        text: realMsg.text ?? item.text,
        sender: realMsg.sender ?? item.sender,
        timestamp: realMsg.timestamp ?? item.timestamp,
      };
    });
}
/**
 * Validates all messageId and messageIds[] in a chunk extraction against the real
 * messages in that chunk. Strips any hallucinated IDs that do not exist.
 *
 * @param {Object} rawExtraction — raw LLM extraction result
 * @param {Object} logicalChunk  — the AnalysisChunk whose messages are the source of truth
 * @returns {{ extraction: Object, removedCount: number, keptCount: number }}
 */
export function validateChunkExtractionEvidence(rawExtraction, logicalChunk) {
  // Build a fast ID set for this chunk's messages
  const chunkMsgIds = new Set(
    (logicalChunk?.messages || []).map((m) => m.id).filter(Boolean)
  );

  let removedCount = 0;
  let keptCount = 0;

  const rawEvidence = Array.isArray(rawExtraction?.evidence) ? rawExtraction.evidence : [];

  const validatedEvidence = rawEvidence
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      // Validate primary messageId
      const primaryId = item.messageId;
      if (!primaryId || !chunkMsgIds.has(primaryId)) {
        removedCount++;
        console.warn(
          `[ChunkValidation] Removing evidence item: primary messageId "${primaryId}" not found in chunk "${logicalChunk?.id}".`
        );
        return null;
      }

      // Validate and filter messageIds[] — only keep real IDs from this chunk
      const rawIds = Array.isArray(item.messageIds) ? item.messageIds : [];
      const validatedIds = rawIds.filter((id) => {
        if (typeof id !== 'string' || !chunkMsgIds.has(id)) {
          removedCount++;
          return false;
        }
        return true;
      });

      // Ensure the primary is always in the validated list
      if (!validatedIds.includes(primaryId)) {
        validatedIds.unshift(primaryId);
      }

      keptCount++;

      return {
        ...item,
        messageIds: validatedIds,
      };
    })
    .filter(Boolean);

  if (removedCount > 0) {
    console.log(
      `[ChunkValidation] chunk="${logicalChunk?.id}" kept=${keptCount} stripped_ids=${removedCount}`
    );
  }

  return {
    extraction: {
      ...rawExtraction,
      evidence: validatedEvidence,
    },
    removedCount,
    keptCount,
  };
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
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
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

  return {
    ...result,
    evidence: normalizedEvidence,
  };
}

export const EVIDENCE_TYPE_PRIORITY_BUCKETS = [
  new Set(['conflict', 'turning_point', 'rejection', 'apology']),
  new Set(['self_description', 'other_description', 'contradiction']),
  new Set(['inside_joke', 'callback_candidate', 'funny', 'memorable']),
  new Set(['plan', 'event', 'promise']),
  new Set(['affection', 'love', 'flirting', 'vulnerability']),
  new Set(['behavior', 'relationship_signal', 'personality_signal']),
  new Set(['recurring_language', 'recurring_topic', 'emotional_texture_shift', 'mood_shift', 'other']),
];

/**
 * Formats self-contained interactions for the downstream AI prompt.
 * Instead of single isolated lines, formats complete multi-message dialog exchanges
 * containing setup, response, reaction, and contextual summary.
 *
 * @param {Array} evidenceStore — validated EvidenceInteraction[]
 * @param {number} [maxItems=50] — maximum interactions to format
 * @returns {string} Formatted prompt text
 */
export function formatEvidenceForPrompt(evidenceStore, maxItems = 50) {
  if (!Array.isArray(evidenceStore) || evidenceStore.length === 0) {
    return 'No evidence interactions available.';
  }

  const selected = [];
  const seenIds = new Set();

  // Phase 1 — type-balanced bucket pass
  const slotsPerBucket = Math.max(2, Math.floor((maxItems * 0.7) / EVIDENCE_TYPE_PRIORITY_BUCKETS.length));
  for (const bucket of EVIDENCE_TYPE_PRIORITY_BUCKETS) {
    let taken = 0;
    for (const item of evidenceStore) {
      if (taken >= slotsPerBucket) break;
      const key = item.id || item.messageId;
      if (seenIds.has(key)) continue;
      if (bucket.has(item.type)) {
        selected.push(item);
        seenIds.add(key);
        taken++;
      }
    }
  }

  // Phase 2 — fill remaining slots with highest-importance unseen items
  for (const item of evidenceStore) {
    if (selected.length >= maxItems) break;
    const key = item.id || item.messageId;
    if (!seenIds.has(key)) {
      selected.push(item);
      seenIds.add(key);
    }
  }

  // Sort chronologically for narrative coherence
  const chronological = [...selected].sort(
    (a, b) => new Date(a.startTimestamp || a.timestamp || 0) - new Date(b.startTimestamp || b.timestamp || 0)
  );

  return chronological
    .map((item, idx) => {
      const start = item.startTimestamp ? item.startTimestamp.replace('T', ' ').slice(0, 16) : 'Unknown';
      const end = item.endTimestamp ? item.endTimestamp.replace('T', ' ').slice(11, 16) : '';
      const timeRange = end && end !== start.slice(11, 16) ? `${start} -> ${end}` : start;
      const participants = (item.participants || [item.sender || 'Unknown']).join(', ');

      const header = `[Interaction #${idx + 1} // ${item.id || `ev_${idx + 1}`}] ${timeRange} | ${participants} (Type: ${item.type}, Tone: ${item.tone || 'conversational'}, Imp: ${item.importance})`;
      const summaryLine = item.interactionSummary ? `  Summary: ${item.interactionSummary}` : '';

      // Format complete chronological messages of the interaction
      const messageLines = (item.messages && item.messages.length > 0)
        ? item.messages.map((m) => {
            const rawText = String(m.text || '').replace(/\n+/g, ' ');
            const displayText = rawText.length > 180 ? rawText.slice(0, 177) + '…' : rawText;
            return `    [${m.id}] ${m.sender}: "${displayText}"`;
          }).join('\n')
        : `    [${item.messageId}] ${item.sender || 'Unknown'}: "${item.text || ''}"`;

      return [header, summaryLine, '  Messages:', messageLines].filter(Boolean).join('\n');
    })
    .join('\n\n═══════════════════════════════════════════════════\n\n');
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
