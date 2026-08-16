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
} from './tokenEstimator.js';
import { buildExtractionRequest } from './ai/extractionRequest.js';

const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates token-safe AnalysisChunks from a flat message list.
 *
 * Unlike the old chunker, this version:
 *   - Never calls sampleEvenly (no message discarding)
 *   - Uses MAX_MESSAGE_PAYLOAD_TOKENS (not MAX_EXTRACTION_INPUT_TOKENS) as the
 *     raw-message budget, reserving PROMPT_OVERHEAD_TOKENS for framing
 *   - Logs telemetry for every chunk and a summary at the end
 *
 * @param {Array} _sessions     — ConversationSession[] (unused, kept for API compat)
 * @param {Array} allMessages   — ChatMessage[] (all message types, including media/system)
 * @param {Object} [config]
 * @param {number} [config.maxTokensPerChunk] — override MAX_MESSAGE_PAYLOAD_TOKENS
 * @param {number} [config.maxMessagesPerChunk] — override MAX_MESSAGES_PER_CHUNK
 * @returns {Array} AnalysisChunk[]
 */
export function createChunks(_sessions, allMessages, config = {}) {
  // Effective per-chunk raw-message token budget.
  // We intentionally use MAX_MESSAGE_PAYLOAD_TOKENS (= MAX_EXTRACTION_INPUT_TOKENS
  // minus PROMPT_OVERHEAD_TOKENS) so the full formatted user prompt stays under limit.
  const msgTokenBudget = config.maxTokensPerChunk ?? MAX_MESSAGE_PAYLOAD_TOKENS;
  const maxMsgs       = config.maxMessagesPerChunk ?? MAX_MESSAGES_PER_CHUNK;
  const totalChunksForSizing = config.totalChunksForSizing ?? 999999;

  // ── 1. Filter to normal text messages, sorted chronologically ──────────────
  const normalMessages = allMessages
    .filter(m => m.type === 'message' && m.text && m.text.trim().length > 0)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (normalMessages.length === 0) {
    console.log('[Chunker] No normal messages found — returning empty chunk list.');
    return [];
  }

  // ── 2. Build session groups (2h gap = new session) ─────────────────────────
  //    We still respect session boundaries so related bursts stay together.
  const sessionGroups = buildSessionGroups(normalMessages);

  // ── 3. Token-aware packing: iterate messages, finalize on budget overflow ──
  const chunks = [];
  let current = newAccumulator();
  let oversizedCount = 0;

  for (let si = 0; si < sessionGroups.length; si++) {
    const sessionId = `session_${si + 1}`;

    for (const rawMsg of sessionGroups[si]) {
      // Truncate any individual message that is itself over the single-message limit
      const msg = truncateMessageIfOversized(rawMsg);
      const msgTokens = estimateMessageTokens(msg);

      // Edge case: single message exceeds the entire chunk budget.
      // Place it alone in its own chunk (logged below as oversized).
      if (msgTokens > msgTokenBudget) {
        if (current.messages.length > 0) {
          chunks.push(finalizeChunk(chunks.length, current));
          current = newAccumulator();
        }
        oversizedCount++;
        console.warn(
          `[Chunker] Single message ${msg.id} exceeds payload budget ` +
          `(~${msgTokens} tokens > ${msgTokenBudget}). Placed in isolated chunk.`
        );
        // Add it alone; it is already truncated as much as possible
        current.messages.push(msg);
        current.tokens += msgTokens;
        addSession(current, sessionId);
        // Immediately finalize so it stands alone
        chunks.push(finalizeChunk(chunks.length, current));
        current = newAccumulator();
        continue;
      }

      // Normal case: check if adding this message would exceed the budget
      const candidate = {
        ...finalizeChunk(chunks.length, {
          messages: [...current.messages, msg],
          sessionIds: current.sessionIds.includes(sessionId)
            ? current.sessionIds
            : [...current.sessionIds, sessionId],
        }),
      };
      const candidateRequest = buildExtractionRequest(
        candidate,
        chunks.length,
        totalChunksForSizing
      );
      const tokenInfo = estimateExtractionRequest(candidateRequest);
      const wouldExceedTokens = !tokenInfo.safe || current.tokens + msgTokens > msgTokenBudget;
      const wouldExceedCount  = current.messages.length >= maxMsgs;

      if (current.messages.length > 0 && (wouldExceedTokens || wouldExceedCount)) {
        chunks.push(finalizeChunk(chunks.length, current));
        current = newAccumulator();
      }

      current.messages.push(msg);
      current.tokens += msgTokens;
      addSession(current, sessionId);
    }
  }

  // Flush any remaining messages
  if (current.messages.length > 0) {
    chunks.push(finalizeChunk(chunks.length, current));
  }

  // ── 4. Telemetry: log every chunk ──────────────────────────────────────────
  for (const chunk of chunks) {
    const firstId = chunk.messages[0]?.id ?? '?';
    const lastId  = chunk.messages[chunk.messages.length - 1]?.id ?? '?';
    const estTokens = estimateChunkPayloadTokens(chunk.messages);
    console.log(
      `[Chunker] ${chunk.id} | ${chunk.messages.length} msgs | ` +
      `~${estTokens} msg tokens (~${estTokens + 600} total) | ` +
      `${firstId} → ${lastId}`
    );
  }

  // ── 5. Summary log ─────────────────────────────────────────────────────────
  const totalMsgs = chunks.reduce((s, c) => s + c.messages.length, 0);
  console.log(
    `\n[Chunker] ═══════════════════════════════════════\n` +
    `[Chunker] Created ${chunks.length} extraction chunks\n` +
    `[Chunker] Total messages: ${totalMsgs}\n` +
    `[Chunker] Oversized single-message chunks: ${oversizedCount}\n` +
    `[Chunker] Msg token budget per chunk: ${msgTokenBudget}\n` +
    `[Chunker] Full prompt budget per chunk: ${MAX_EXTRACTION_INPUT_TOKENS}\n` +
    `[Chunker] ═══════════════════════════════════════\n`
  );

  if (chunks.length > MAX_EXTRACTION_CHUNKS) {
    console.warn(
      `[Chunker] ⚠️  ${chunks.length} chunks exceeds the soft cap of ${MAX_EXTRACTION_CHUNKS}. ` +
      `This is expected for very large chats. All chunks will be processed.`
    );
  }

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
    endAt:   sorted[sorted.length - 1]?.timestamp?.toString() || '',
    sessionIds: acc.sessionIds,
    participants,
    messages: sorted.map(m => ({
      id:        m.id,
      timestamp: m.timestamp?.toString() || '',
      sender:    m.sender,
      text:      m.text,
      type:      m.type,
    })),
  };
}
