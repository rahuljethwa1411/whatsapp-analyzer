/**
 * Token-Budget & Count-Bounded Chunker (TypeScript client version)
 *
 * Mirrors the server-side chunker.js logic.
 * Enforces token budgets (~2,500 tokens max) AND message count limits (120 msgs max).
 * Evenly samples up to 20 representative timeline chunks for large chats.
 */

import { ChatMessage } from '../types/chat';
import { ConversationSession } from '../types/analysis';
import { AnalysisChunk } from '../types/intelligence';

// ─── Token Budget ─────────────────────────────────────────────────────────────

const MAX_EXTRACTION_INPUT_TOKENS = 2500;
const MAX_MESSAGES_PER_CHUNK = 120;
const MAX_EXTRACTION_CHUNKS = 20;
const MAX_SINGLE_MESSAGE_TOKENS = 500;
const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Token Estimator ──────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  if (!text) return 0;
  let asciiCount = 0;
  let unicodeCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) asciiCount++;
    else unicodeCount++;
  }
  const raw = asciiCount / 3.8 + unicodeCount / 1.5;
  return Math.max(1, Math.ceil(raw * 1.1));
}

function estimateMessageTokens(msg: { id: string; sender: string | null; text: string }): number {
  const line = `[${msg.id}] ${msg.sender || 'Unknown'}: ${msg.text || ''}\n`;
  return estimateTokens(line);
}

function estimateChunkPayloadTokens(
  messages: Array<{ id: string; sender: string | null; text: string }>
): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
}

function truncateMessageIfOversized(msg: ChatMessage): ChatMessage {
  if (estimateMessageTokens(msg as any) <= MAX_SINGLE_MESSAGE_TOKENS) return msg;

  let lo = 0;
  let hi = msg.text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const candidate = { ...msg, text: msg.text.slice(0, mid) + '…' };
    if (estimateMessageTokens(candidate as any) <= MAX_SINGLE_MESSAGE_TOKENS) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return { ...msg, text: msg.text.slice(0, lo) + ' [truncated]' };
}

// ─── Chunker ─────────────────────────────────────────────────────────────────

export function createAnalysisChunks(
  messages: ChatMessage[],
  _sessions: ConversationSession[],
  maxTokensPerChunk: number = MAX_EXTRACTION_INPUT_TOKENS
): AnalysisChunk[] {
  const normalMessages = messages
    .filter(m => m.type === 'message' && m.text && m.text.trim().length > 0)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (normalMessages.length === 0) return [];

  // ── 1. Group into sessions by 2h gap ────────────────────────────────────
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

  // ── 2. Pack sessions into token- & count-budgeted chunks ───────────────────
  const allRawChunks: AnalysisChunk[] = [];
  let currentChunkMessages: ChatMessage[] = [];
  let currentChunkTokens = 0;
  let currentSessionIds: string[] = [];
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
    const sessionTokens = estimateChunkPayloadTokens(sg as any[]);

    const fitsInCurrent =
      currentChunkMessages.length + sg.length <= MAX_MESSAGES_PER_CHUNK &&
      currentChunkTokens + sessionTokens <= maxTokensPerChunk;

    if (fitsInCurrent) {
      currentChunkMessages.push(...sg);
      currentChunkTokens += sessionTokens;
      currentSessionIds.push(sessionId);
    } else if (sessionTokens <= maxTokensPerChunk && sg.length <= MAX_MESSAGES_PER_CHUNK) {
      finalizeChunk();
      currentChunkMessages.push(...sg);
      currentChunkTokens += sessionTokens;
      currentSessionIds.push(sessionId);
    } else {
      if (currentChunkMessages.length > 0) finalizeChunk();

      for (const rawMsg of sg) {
        const msg = truncateMessageIfOversized(rawMsg);
        const msgTokens = estimateChunkPayloadTokens([msg as any]);

        if (
          currentChunkMessages.length > 0 &&
          (currentChunkMessages.length >= MAX_MESSAGES_PER_CHUNK ||
            currentChunkTokens + msgTokens > maxTokensPerChunk)
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

  if (allRawChunks.length <= MAX_EXTRACTION_CHUNKS) {
    return allRawChunks;
  }

  return sampleEvenly(allRawChunks, MAX_EXTRACTION_CHUNKS);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildChunk(
  index: number,
  sessionIds: string[],
  messages: ChatMessage[]
): AnalysisChunk {
  const sorted = [...messages].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
  const participants = [
    ...new Set(sorted.map(m => m.sender).filter(Boolean)),
  ] as string[];

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

function sampleEvenly(arr: AnalysisChunk[], count: number): AnalysisChunk[] {
  if (arr.length <= count) return arr;
  const result: AnalysisChunk[] = [arr[0]];
  const step = (arr.length - 1) / (count - 1);
  for (let i = 1; i < count - 1; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  result.push(arr[arr.length - 1]);
  return result.map((c, i) => ({ ...c, id: `chunk_${i + 1}` }));
}
