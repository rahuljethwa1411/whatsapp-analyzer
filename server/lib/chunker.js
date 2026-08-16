/**
 * Token-Budget & Count-Bounded Chunker
 *
 * Groups messages into AnalysisChunks respecting session boundaries,
 * token budgets (~2500 tokens max), and message count limits (120 msgs max).
 *
 * For mega chats (25k-50k+ messages), evenly samples up to MAX_EXTRACTION_CHUNKS (20)
 * across the entire timeline to ensure analysis completes in under 20 seconds
 * without exceeding Groq TPM limits.
 */

import {
  estimateChunkPayloadTokens,
  truncateMessageIfOversized,
  MAX_EXTRACTION_INPUT_TOKENS,
  MAX_MESSAGES_PER_CHUNK,
  MAX_EXTRACTION_CHUNKS,
} from './tokenEstimator.js';

const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * @param {Array} sessions      — ConversationSession[] from Phase 2
 * @param {Array} allMessages   — ChatMessage[] (all message types)
 * @param {Object} [config]
 * @returns {Array} AnalysisChunk[]
 */
export function createChunks(sessions, allMessages, config = {}) {
  const maxTokens = config.maxTokensPerChunk
    ?? parseInt(process.env.MAX_EXTRACTION_INPUT_TOKENS || '2500', 10);
  const maxMsgs = config.maxMessagesPerChunk || MAX_MESSAGES_PER_CHUNK;
  const maxChunksCap = config.maxChunks || MAX_EXTRACTION_CHUNKS;

  // ── 1. Filter + sort normal messages only ───────────────────────────────────
  const normalMessages = allMessages
    .filter(m => m.type === 'message' && m.text && m.text.trim().length > 0)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (normalMessages.length === 0) return [];

  // ── 2. Re-group into sessions by 2h gap ────────────────────────────────────
  const sessionGroups = [];
  let currentGroup = [normalMessages[0]];

  for (let i = 1; i < normalMessages.length; i++) {
    const prev = normalMessages[i - 1];
    const curr = normalMessages[i];
    const gap = new Date(curr.timestamp) - new Date(prev.timestamp);
    if (gap <= SESSION_GAP_MS) {
      currentGroup.push(curr);
    } else {
      sessionGroups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  if (currentGroup.length > 0) sessionGroups.push(currentGroup);

  // ── 3. Pack sessions into token- & count-budgeted chunks ───────────────────
  const allRawChunks = [];
  let currentChunkMessages = [];
  let currentChunkTokens = 0;
  let currentSessionIds = [];
  let chunkIndex = 0;

  const finalizeChunk = () => {
    if (currentChunkMessages.length === 0) return;
    allRawChunks.push(buildChunk(chunkIndex, currentSessionIds, currentChunkMessages));
    chunkIndex++;
    currentChunkMessages = [];
    currentChunkTokens = 0;
    currentSessionIds = [];
  };

  for (let si = 0; si < sessionGroups.length; si++) {
    const sg = sessionGroups[si];
    const sessionId = `session_${si + 1}`;
    const sessionTokens = estimateChunkPayloadTokens(sg);

    const fitsInCurrent =
      currentChunkMessages.length + sg.length <= maxMsgs &&
      currentChunkTokens + sessionTokens <= maxTokens;

    if (fitsInCurrent) {
      currentChunkMessages.push(...sg);
      currentChunkTokens += sessionTokens;
      currentSessionIds.push(sessionId);
    } else if (sessionTokens <= maxTokens && sg.length <= maxMsgs) {
      // Session fits in its own chunk — flush current first
      finalizeChunk();
      currentChunkMessages.push(...sg);
      currentChunkTokens += sessionTokens;
      currentSessionIds.push(sessionId);
    } else {
      // Oversized session — split message by message
      if (currentChunkMessages.length > 0) finalizeChunk();

      for (const rawMsg of sg) {
        const msg = truncateMessageIfOversized(rawMsg);
        const msgTokens = estimateChunkPayloadTokens([msg]);

        if (
          currentChunkMessages.length > 0 &&
          (currentChunkMessages.length >= maxMsgs ||
            currentChunkTokens + msgTokens > maxTokens)
        ) {
          finalizeChunk();
        }

        currentChunkMessages.push(msg);
        currentChunkTokens += msgTokens;
        if (!currentSessionIds.includes(sessionId)) {
          currentSessionIds.push(sessionId);
        }
      }
    }
  }

  finalizeChunk();

  // ── 4. If more chunks than cap, sample representative chunks ──────────────
  if (allRawChunks.length <= maxChunksCap) {
    return allRawChunks;
  }

  console.log(
    `[Chunker] Chat produced ${allRawChunks.length} chunks. Sampling ${maxChunksCap} representative timeline chunks.`
  );
  return sampleEvenly(allRawChunks, maxChunksCap);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildChunk(index, sessionIds, messages) {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  const participants = [
    ...new Set(sorted.map(m => m.sender).filter(Boolean)),
  ];

  return {
    id: `chunk_${index + 1}`,
    startAt: sorted[0]?.timestamp?.toString() || '',
    endAt: sorted[sorted.length - 1]?.timestamp?.toString() || '',
    sessionIds,
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

function sampleEvenly(arr, count) {
  if (arr.length <= count) return arr;
  const result = [arr[0]];
  const step = (arr.length - 1) / (count - 1);
  for (let i = 1; i < count - 1; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  result.push(arr[arr.length - 1]);
  return result.map((c, i) => ({ ...c, id: `chunk_${i + 1}` }));
}
