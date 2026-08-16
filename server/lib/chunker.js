/**
 * Smart Chunker
 * Groups messages into AnalysisChunks respecting session boundaries.
 * Default: 300 messages per chunk max.
 */

const DEFAULT_MAX_MESSAGES_PER_CHUNK = 300;

/**
 * @param {Array} sessions     — ConversationSession[] from Phase 2
 * @param {Array} allMessages  — ChatMessage[] (normal messages only)
 * @param {Object} config
 * @returns {Array} AnalysisChunk[]
 */
export function createChunks(sessions, allMessages, config = {}) {
  const maxPerChunk = config.maxMessagesPerChunk || DEFAULT_MAX_MESSAGES_PER_CHUNK;

  // Build a message lookup map by ID
  const msgMap = new Map();
  for (const m of allMessages) {
    msgMap.set(m.id, m);
  }

  // Build a map of session → message IDs (we need to find messages per session)
  // Since sessions only store message counts / participants, we rebuild by timestamp
  const normalMessages = allMessages
    .filter(m => m.type === 'message')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2h

  // Re-group messages into sessions (same logic as Phase 2 session calculator)
  const sessionGroups = [];
  let currentGroup = [];

  for (let i = 0; i < normalMessages.length; i++) {
    if (i === 0) {
      currentGroup.push(normalMessages[i]);
      continue;
    }
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

  // Now group sessions into chunks by message count
  const chunks = [];
  let currentChunkSessions = [];
  let currentChunkMessages = [];
  let chunkIndex = 0;

  for (const sg of sessionGroups) {
    // If adding this session would exceed the limit, finalize current chunk
    if (currentChunkMessages.length > 0 && currentChunkMessages.length + sg.length > maxPerChunk) {
      chunks.push(buildChunk(chunkIndex, currentChunkSessions, currentChunkMessages));
      chunkIndex++;
      currentChunkSessions = [];
      currentChunkMessages = [];
    }

    currentChunkSessions.push(`session_${sessionGroups.indexOf(sg) + 1}`);
    currentChunkMessages.push(...sg);
  }

  // Finalize last chunk
  if (currentChunkMessages.length > 0) {
    chunks.push(buildChunk(chunkIndex, currentChunkSessions, currentChunkMessages));
  }

  return chunks;
}

function buildChunk(index, sessionIds, messages) {
  const sorted = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const participants = [...new Set(sorted.map(m => m.sender).filter(Boolean))];

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
