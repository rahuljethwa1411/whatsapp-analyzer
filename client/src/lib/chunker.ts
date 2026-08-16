import { ChatMessage } from '../types/chat';
import { ConversationSession } from '../types/analysis';
import { AnalysisChunk } from '../types/intelligence';

const DEFAULT_MAX_MESSAGES_PER_CHUNK = 300;
const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2h

/**
 * Creates AnalysisChunk[] from parsed messages and sessions.
 * Respects session boundaries — never splits an active conversation.
 */
export function createAnalysisChunks(
  messages: ChatMessage[],
  _sessions: ConversationSession[],
  maxPerChunk: number = DEFAULT_MAX_MESSAGES_PER_CHUNK
): AnalysisChunk[] {
  const normalMessages = messages
    .filter(m => m.type === 'message')
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (normalMessages.length === 0) return [];

  // Re-group into sessions by 2h gap
  const sessionGroups: ChatMessage[][] = [];
  let currentGroup: ChatMessage[] = [normalMessages[0]];

  for (let i = 1; i < normalMessages.length; i++) {
    const prev = normalMessages[i - 1];
    const curr = normalMessages[i];
    const gap = curr.timestamp.getTime() - prev.timestamp.getTime();
    if (gap <= SESSION_GAP_MS) {
      currentGroup.push(curr);
    } else {
      sessionGroups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  if (currentGroup.length > 0) sessionGroups.push(currentGroup);

  // Group sessions into chunks by message count
  const chunks: AnalysisChunk[] = [];
  let currentChunkSessions: string[] = [];
  let currentChunkMessages: ChatMessage[] = [];
  let chunkIndex = 0;

  for (let si = 0; si < sessionGroups.length; si++) {
    const sg = sessionGroups[si];
    if (currentChunkMessages.length > 0 && currentChunkMessages.length + sg.length > maxPerChunk) {
      chunks.push(buildChunk(chunkIndex, currentChunkSessions, currentChunkMessages));
      chunkIndex++;
      currentChunkSessions = [];
      currentChunkMessages = [];
    }
    currentChunkSessions.push(`session_${si + 1}`);
    currentChunkMessages.push(...sg);
  }

  if (currentChunkMessages.length > 0) {
    chunks.push(buildChunk(chunkIndex, currentChunkSessions, currentChunkMessages));
  }

  return chunks;
}

function buildChunk(index: number, sessionIds: string[], messages: ChatMessage[]): AnalysisChunk {
  const sorted = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const participants = [...new Set(sorted.map(m => m.sender).filter(Boolean))] as string[];

  return {
    id: `chunk_${index + 1}`,
    startAt: sorted[0]?.timestamp?.toISOString() || '',
    endAt: sorted[sorted.length - 1]?.timestamp?.toISOString() || '',
    sessionIds,
    participants,
    messages: sorted.map(m => ({
      id: m.id,
      timestamp: m.timestamp?.toISOString() || '',
      sender: m.sender,
      text: m.text,
      type: m.type,
    })),
  };
}
