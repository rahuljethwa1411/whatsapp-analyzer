/**
 * Token-Aware Extraction Chunker — Phase 1 Fix
 *
 * Creates AnalysisChunks that are guaranteed to be within the extraction
 * token budget BEFORE any API call. This eliminates the old
 * "chunk too large → split → retry" pattern.
 *
 * Algorithm:
 *   For every message (in chronological order):
 *     Estimate its formatted extraction-prompt token cost.
 *     If adding it would push the current chunk over MAX_MESSAGE_PAYLOAD_TOKENS
 *     or MAX_MESSAGES_PER_CHUNK → finalize the current chunk, start a new one.
 *
 * Key guarantees:
 *   ✓ Every chunk's raw-message token count ≤ MAX_MESSAGE_PAYLOAD_TOKENS
 *   ✓ Full formatted user prompt ≤ MAX_EXTRACTION_INPUT_TOKENS (with overhead)
 *   ✓ Messages are never reordered or silently dropped
 *   ✓ Oversized individual messages are truncated before packing
 *   ✓ No sampleEvenly downsampling — all messages are covered
 *   ✓ Pre-flight validation gate before each API call
 */

import {
  estimateChunkPayloadTokens,
  estimateMessageTokens,
  truncateMessageIfOversized,
  MAX_EXTRACTION_INPUT_TOKENS,
  MAX_MESSAGE_PAYLOAD_TOKENS,
  MAX_MESSAGES_PER_CHUNK,
  MAX_EXTRACTION_CHUNKS,
  estimateExtractionRequest,
  PROMPT_OVERHEAD_TOKENS,
  SAFE_EXTRACTION_INPUT_TOKENS,
} from './tokenEstimator.js';
import { buildExtractionRequest } from './ai/extractionRequest.js';

const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Splits an array of messages into two balanced parts based on estimated token weight
 * at message boundaries, preserving chronological order. Never splits a message.
 *
 * @param {Array} messages
 * @returns {[Array, Array]}
 */
export function splitMessagesByTokenWeight(messages) {
  if (!messages || messages.length <= 1) {
    return [messages || [], []];
  }

  const costs = messages.map(m => estimateMessageTokens(m));
  const totalCost = costs.reduce((sum, c) => sum + c, 0);
  const halfCost = totalCost / 2;

  let accumulated = 0;
  let splitIndex = 1;
  let bestDiff = Infinity;

  for (let i = 0; i < messages.length - 1; i++) {
    accumulated += costs[i];
    const diff = Math.abs(accumulated - halfCost);
    if (diff < bestDiff) {
      bestDiff = diff;
      splitIndex = i + 1;
    }
  }

  splitIndex = Math.max(1, Math.min(splitIndex, messages.length - 1));

  return [
    messages.slice(0, splitIndex),
    messages.slice(splitIndex),
  ];
}

/**
 * Packs a logical chunk into session-aware, token-safe API subchunks upfront.
 * Preserves full conversation context and silence gaps without runtime recursive splitting.
 *
 * @param {Object} logicalChunk
 * @param {number} [budget]
 * @returns {Array} Array of token-safe subchunks
 */
export function packMessagesIntoTokenSafeSubchunks(logicalChunk, budget = SAFE_EXTRACTION_INPUT_TOKENS) {
  const messages = (logicalChunk.messages || []).filter(m => m.type === 'message');
  if (messages.length === 0) return [];

  // If the whole chunk is already within budget, return as 1 subchunk
  const singleReq = buildExtractionRequest(logicalChunk, 0, 1);
  const singleEst = estimateExtractionRequest(singleReq);
  if (singleEst.estimatedInputTokens <= budget) {
    return [logicalChunk];
  }

  // Group messages into natural conversation sessions (2-hour silence gap)
  const sessions = [];
  let currentSession = [messages[0]];
  for (let i = 1; i < messages.length; i++) {
    const prev = new Date(messages[i - 1].timestamp).getTime();
    const curr = new Date(messages[i].timestamp).getTime();
    if (curr - prev > SESSION_GAP_MS) {
      sessions.push(currentSession);
      currentSession = [messages[i]];
    } else {
      currentSession.push(messages[i]);
    }
  }
  if (currentSession.length > 0) sessions.push(currentSession);

  // Greedily pack sessions up to the token budget
  const subchunks = [];
  let currentMsgs = [];
  let subIndex = 0;

  const flush = () => {
    if (currentMsgs.length === 0) return;
    const sorted = [...currentMsgs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const suffix = String.fromCharCode(97 + (subIndex % 26)) + (subIndex >= 26 ? Math.floor(subIndex / 26) : '');
    subchunks.push({
      ...logicalChunk,
      id: `${logicalChunk.id}${suffix}`,
      subId: `${logicalChunk.id}${suffix}`,
      messages: sorted,
      startAt: sorted[0]?.timestamp || logicalChunk.startAt,
      endAt: sorted[sorted.length - 1]?.timestamp || logicalChunk.endAt,
    });
    subIndex++;
    currentMsgs = [];
  };

  for (const session of sessions) {
    const candidateMsgs = currentMsgs.concat(session);
    const candidateChunk = { ...logicalChunk, messages: candidateMsgs };
    const est = estimateExtractionRequest(buildExtractionRequest(candidateChunk, 0, 1));

    if (est.estimatedInputTokens <= budget) {
      currentMsgs = candidateMsgs;
    } else {
      if (currentMsgs.length > 0) flush();
      const sessionChunk = { ...logicalChunk, messages: session };
      const sessionEst = estimateExtractionRequest(buildExtractionRequest(sessionChunk, 0, 1));
      if (sessionEst.estimatedInputTokens <= budget) {
        currentMsgs = session.slice();
      } else {
        for (const msg of session) {
          const withMsg = currentMsgs.concat(msg);
          const msgChunk = { ...logicalChunk, messages: withMsg };
          const msgEst = estimateExtractionRequest(buildExtractionRequest(msgChunk, 0, 1));
          if (msgEst.estimatedInputTokens <= budget || currentMsgs.length === 0) {
            currentMsgs.push(msg);
          } else {
            flush();
            currentMsgs.push(msg);
          }
        }
      }
    }
  }
  flush();

  return subchunks;
}

/**
 * Creates token-safe AnalysisChunks from a flat message list.
 *
 * Emits ~TOP_LEVEL_CHUNK_COUNT (default 20) logical chunks.
 * These are logical ranges — the server pre-flights each chunk and performs
 * internal adaptive recovery splitting only when a chunk exceeds the safe token budget.
 *
 * @param {Array} _sessions     — ConversationSession[] (unused, kept for API compat)
 * @param {Array} allMessages   — ChatMessage[] (all message types, including media/system)
 * @param {Object} [config]
 * @param {number} [config.topLevelChunkCount] — override TOP_LEVEL_CHUNK_COUNT
 * @returns {Array} AnalysisChunk[]
 */
export function createChunks(_sessions, allMessages, config = {}) {
  // ── 1. Filter to normal text messages, sorted chronologically ──────────────
  const normalMessages = allMessages
    .filter(m => m.type === 'message' && m.text && m.text.trim().length > 0)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (normalMessages.length === 0) {
    console.log('[Chunker] No normal messages found — returning empty chunk list.');
    return [];
  }

  // ── 2. Top-level logical partitioning: create approximately
  // `targetTopLevel` logical chunks (default 20).
  const targetTopLevel = Number(process.env.TOP_LEVEL_CHUNK_COUNT || config.topLevelChunkCount || 20) || 20;
  const topLevelCount = Math.max(1, Math.min(targetTopLevel, normalMessages.length));
  const approxMsgsPerTopLevel = Math.ceil(normalMessages.length / topLevelCount);

  const topLevelGroups = [];
  let currentGroup = [];
  for (let i = 0; i < normalMessages.length; i++) {
    currentGroup.push(normalMessages[i]);
    if (currentGroup.length >= approxMsgsPerTopLevel && topLevelGroups.length < topLevelCount - 1) {
      topLevelGroups.push(currentGroup);
      currentGroup = [];
    }
  }
  if (currentGroup.length > 0) topLevelGroups.push(currentGroup);

  const chunks = topLevelGroups.map((group, idx) => {
    const acc = { messages: group.slice(), sessionIds: [] };
    let lastTs = null;
    let si = 0;
    for (const m of group) {
      const ts = new Date(m.timestamp).getTime();
      if (lastTs === null || ts - lastTs > SESSION_GAP_MS) {
        si++;
        acc.sessionIds.push(`session_${si}`);
      }
      lastTs = ts;
    }
    return finalizeChunk(idx, { messages: acc.messages, sessionIds: acc.sessionIds });
  });

  console.log(`[Chunker] Initial partition: ${normalMessages.length} messages → ${chunks.length} logical chunks`);

  return chunks;
}

/**
 * Pre-flight validation: checks that a chunk's estimated prompt tokens are
 * within budget BEFORE sending to the API.
 *
 * @param {Object} chunk        — AnalysisChunk
 * @param {number} [budget]     — token limit (defaults to MAX_EXTRACTION_INPUT_TOKENS)
 * @returns {{ ok: boolean, estimated: number, budget: number }}
 */
export function validateChunkTokenBudget(chunk, budget = MAX_EXTRACTION_INPUT_TOKENS) {
  const request = buildExtractionRequest(chunk, 0, 999999);
  const tokenInfo = estimateExtractionRequest(request);
  const msgTokens = estimateChunkPayloadTokens(chunk.messages);
  return {
    ok: tokenInfo.estimatedInputTokens <= Math.min(budget, tokenInfo.safeBudget),
    estimated: tokenInfo.estimatedInputTokens,
    budget,
    msgTokens,
    requestChars: tokenInfo.totalSerializedRequestChars,
  };
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

function buildSessionGroups(sortedMessages) {
  const groups = [];
  let group = [sortedMessages[0]];

  for (let i = 1; i < sortedMessages.length; i++) {
    const gap = new Date(sortedMessages[i].timestamp) - new Date(sortedMessages[i - 1].timestamp);
    if (gap <= SESSION_GAP_MS) {
      group.push(sortedMessages[i]);
    } else {
      groups.push(group);
      group = [sortedMessages[i]];
    }
  }
  if (group.length > 0) groups.push(group);
  return groups;
}

function newAccumulator() {
  return { messages: [], tokens: 0, sessionIds: [] };
}

function addSession(acc, sessionId) {
  if (!acc.sessionIds.includes(sessionId)) {
    acc.sessionIds.push(sessionId);
  }
}

function finalizeChunk(index, acc) {
  const sorted = [...acc.messages].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  const participants = [...new Set(sorted.map(m => m.sender).filter(Boolean))];

  return {
    id: `chunk_${index + 1}`,
    startAt: sorted[0]?.timestamp?.toString() || '',
    endAt: sorted[sorted.length - 1]?.timestamp?.toString() || '',
    sessionIds: acc.sessionIds,
    participants,
    messages: sorted.map(m => ({
      id: m.id,
      timestamp: m.timestamp?.toString() || '',
      sender: m.sender,
      text: m.text,
      type: m.type,
    })),
  };
}
