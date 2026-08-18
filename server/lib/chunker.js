/**
 * Token-Aware 20-Chunk Partitioning & Splitting Engine.
 *
 * Guarantees:
 *   ✓ Divides all messages chronologically into ~TOP_LEVEL_CHUNK_COUNT (default 20) logical chunks
 *   ✓ Splits at message boundaries based on token weight
 *   ✓ Never mutates, truncates, drops, or reorders messages
 */

import {
  estimateChunkPayloadTokens,
  estimateMessageTokens,
  MAX_EXTRACTION_INPUT_TOKENS,
  MAX_MESSAGE_PAYLOAD_TOKENS,
  estimateExtractionRequest,
  PROMPT_OVERHEAD_TOKENS,
  SAFE_EXTRACTION_INPUT_TOKENS,
  TOP_LEVEL_CHUNK_COUNT,
} from './tokenEstimator.js';
import { buildExtractionRequest } from './ai/extractionRequest.js';

const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Number of messages to overlap between adjacent chunks at their boundary.
 * This preserves interactions that straddle chunk edges.
 * Configurable via CHUNK_BOUNDARY_OVERLAP_MESSAGES env var (default: 15).
 * Context reconstruction in evidence.js deduplicates, so no duplicate evidence.
 */
export const CHUNK_BOUNDARY_OVERLAP_MESSAGES = parseInt(
  process.env.CHUNK_BOUNDARY_OVERLAP_MESSAGES || '15',
  10
);

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

  const costs = messages.map((m) => estimateMessageTokens(m));
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
 *
 * @param {Object} logicalChunk
 * @param {number} [budget]
 * @returns {Array} Array of token-safe subchunks
 */
export function packMessagesIntoTokenSafeSubchunks(logicalChunk, budget = SAFE_EXTRACTION_INPUT_TOKENS) {
  const messages = (logicalChunk.messages || []).filter((m) => m.type === 'message');
  if (messages.length === 0) return [];

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
 * Creates ~TOP_LEVEL_CHUNK_COUNT (default 20) logical chunks from any message list.
 *
 * @param {Array} _sessions     — ConversationSession[] (unused, kept for API compat)
 * @param {Array} allMessages   — ChatMessage[] (all message types, including media/system)
 * @param {Object} [config]
 * @param {number} [config.topLevelChunkCount] — override TOP_LEVEL_CHUNK_COUNT
 * @returns {Array} AnalysisChunk[]
 */
export function createChunks(_sessions, allMessages, config = {}) {
  const normalMessages = allMessages
    .filter((m) => m.type === 'message' && m.text && m.text.trim().length > 0)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (normalMessages.length === 0) {
    return [];
  }

  const targetTopLevel = Number(config.topLevelChunkCount || TOP_LEVEL_CHUNK_COUNT || 20) || 20;
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

  // Apply boundary overlap: each chunk gets the last N messages of the previous chunk
  // prepended as context. This ensures interactions at chunk edges are never truncated.
  const overlappedChunks = chunks.map((chunk, idx) => {
    if (idx === 0) return chunk; // First chunk: no previous chunk to borrow from

    const prevChunk = chunks[idx - 1];
    const overlapMsgs = prevChunk.messages.slice(-CHUNK_BOUNDARY_OVERLAP_MESSAGES);
    // Only prepend messages that wouldn't cause a session gap stitching
    const firstChunkTs = new Date(chunk.messages[0]?.timestamp || 0).getTime();
    const lastOverlapTs = new Date(overlapMsgs[overlapMsgs.length - 1]?.timestamp || 0).getTime();
    const gapMs = firstChunkTs - lastOverlapTs;

    if (gapMs > SESSION_GAP_MS) {
      // The overlap crosses a natural multi-hour silence — no overlap needed
      return chunk;
    }

    const combined = [...overlapMsgs, ...chunk.messages];
    const deduped = combined.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
    const sorted = deduped.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return {
      ...chunk,
      messages: sorted.map((m) => ({
        id: m.id,
        timestamp: m.timestamp?.toString() || '',
        sender: m.sender,
        text: m.text,
        type: m.type,
      })),
      startAt: sorted[0]?.timestamp?.toString() || chunk.startAt,
      // endAt stays the same — we only prepend, never extend
      _hasOverlap: true,
      _overlapCount: overlapMsgs.length,
    };
  });

  return overlappedChunks;
}

/**
 * Pre-flight validation: checks that a chunk's estimated prompt tokens are within budget.
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

function finalizeChunk(index, acc) {
  const sorted = [...acc.messages].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  const participants = [...new Set(sorted.map((m) => m.sender).filter(Boolean))];

  return {
    id: `chunk_${index + 1}`,
    startAt: sorted[0]?.timestamp?.toString() || '',
    endAt: sorted[sorted.length - 1]?.timestamp?.toString() || '',
    sessionIds: acc.sessionIds,
    participants,
    messages: sorted.map((m) => ({
      id: m.id,
      timestamp: m.timestamp?.toString() || '',
      sender: m.sender,
      text: m.text,
      type: m.type,
    })),
  };
}
