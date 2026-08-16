/**
 * Token-Aware Extraction Chunker (TypeScript client version) — Phase 1 Fix
 *
 * Groups messages into AnalysisChunks respecting token budgets (~4,000 max total input),
 * message count limits (120 msgs max), and session boundaries.
 *
 * Guarantees:
 *   ✓ Every chunk stays strictly under MAX_MESSAGE_PAYLOAD_TOKENS (3400)
 *   ✓ Prompt overhead (~600) is accounted for
 *   ✓ No arbitrary 20-chunk downsampling (all messages covered)
 *   ✓ Strict chronological order preserved
 *   ✓ Oversized single messages truncated safely
 */

import { ChatMessage } from '../types/chat';
import { ConversationSession } from '../types/analysis';
import { AnalysisChunk } from '../types/intelligence';

// ─── Token Budget ─────────────────────────────────────────────────────────────

export const PROMPT_OVERHEAD_TOKENS = 600;
export const MAX_EXTRACTION_INPUT_TOKENS = 4000;
export const MAX_MESSAGE_PAYLOAD_TOKENS =
  MAX_EXTRACTION_INPUT_TOKENS - PROMPT_OVERHEAD_TOKENS; // 3400
export const MAX_MESSAGES_PER_CHUNK = 120;
export const MAX_SINGLE_MESSAGE_TOKENS = 500;
const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Token Estimator ──────────────────────────────────────────────────────────

export function estimateTokens(text: string): number {
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

export function estimateMessageTokens(msg: { id: string; sender: string | null; timestamp?: Date | string; text: string }): number {
  const ts = msg.timestamp ? (typeof msg.timestamp === 'string' ? msg.timestamp : msg.timestamp.toISOString()) : '';
  const line = `[${msg.id}] [${ts}] ${msg.sender || 'Unknown'}: ${msg.text || ''}\n`;
  return estimateTokens(line);
}

export function estimateChunkPayloadTokens(
  messages: Array<{ id: string; sender: string | null; timestamp?: Date | string; text: string }>
): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
}

export function truncateMessageIfOversized(msg: ChatMessage): ChatMessage {
  if (estimateMessageTokens(msg) <= MAX_SINGLE_MESSAGE_TOKENS) return msg;

  let lo = 0;
  let hi = msg.text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const candidate = { ...msg, text: msg.text.slice(0, mid) + '…' };
    if (estimateMessageTokens(candidate) <= MAX_SINGLE_MESSAGE_TOKENS) {
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
  maxTokensPerChunk: number = MAX_MESSAGE_PAYLOAD_TOKENS
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

  // ── 2. Pack sessions token-by-token ──────────────────────────────────────
  const chunks: AnalysisChunk[] = [];
  let currentMessages: ChatMessage[] = [];
  let currentTokens = 0;
  let currentSessionIds: string[] = [];
  let chunkIndex = 0;
  let oversizedCount = 0;

  const finalize = () => {
    if (currentMessages.length === 0) return;
    chunks.push(buildChunk(chunkIndex, currentSessionIds, currentMessages));
    chunkIndex++;
    currentMessages = [];
    currentTokens = 0;
    currentSessionIds = [];
  };

  for (let si = 0; si < sessionGroups.length; si++) {
    const sessionId = `session_${si + 1}`;

    for (const rawMsg of sessionGroups[si]) {
      const msg = truncateMessageIfOversized(rawMsg);
      const msgTokens = estimateMessageTokens(msg);

      if (msgTokens > maxTokensPerChunk) {
        if (currentMessages.length > 0) finalize();
        oversizedCount++;
        console.warn(
          `[Chunker] Single message ${msg.id} exceeds budget (${msgTokens} > ${maxTokensPerChunk}). Isolated.`
        );
        currentMessages.push(msg);
        currentTokens += msgTokens;
        if (!currentSessionIds.includes(sessionId)) currentSessionIds.push(sessionId);
        finalize();
        continue;
      }

      const wouldExceedTokens = currentTokens + msgTokens > maxTokensPerChunk;
      const wouldExceedCount = currentMessages.length >= MAX_MESSAGES_PER_CHUNK;

      if (currentMessages.length > 0 && (wouldExceedTokens || wouldExceedCount)) {
        finalize();
      }

      currentMessages.push(msg);
      currentTokens += msgTokens;
      if (!currentSessionIds.includes(sessionId)) {
        currentSessionIds.push(sessionId);
      }
    }
  }

  finalize();

  // ── 3. Telemetry ──────────────────────────────────────────────────────────
  for (const chunk of chunks) {
    const firstId = chunk.messages[0]?.id ?? '?';
    const lastId = chunk.messages[chunk.messages.length - 1]?.id ?? '?';
    const estTokens = estimateChunkPayloadTokens(chunk.messages as any);
    console.log(
      `[Chunker] ${chunk.id} | ${chunk.messages.length} msgs | ~${estTokens} msg tokens (~${estTokens + PROMPT_OVERHEAD_TOKENS} total) | ${firstId} → ${lastId}`
    );
  }

  console.log(
    `[Chunker] Created ${chunks.length} extraction chunks | Total messages: ${normalMessages.length} | Oversized single messages: ${oversizedCount}`
  );

  return chunks;
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
