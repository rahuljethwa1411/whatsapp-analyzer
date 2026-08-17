import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

/**
 * Token Estimator
 *
 * Conservative character-based token estimation for WhatsApp messages.
 * Real tokenizers are model-specific and not available in plain Node ESM.
 * We use ~3.8 chars/token for ASCII text and ~1.5 chars/token for emoji/CJK/unicode.
 *
 * Budget constants — ALL other modules must import from here.
 */

// ─── Budget Constants ────────────────────────────────────────────────────────

/**
 * Estimated token overhead of all non-message framing inside the extraction
 * user prompt (header, separators, example block, footer rules).
 *
 * The extraction user prompt looks like:
 *   CHUNK N OF M\nPeriod: ...\nParticipants: ...\n   → ~50  tokens
 *   ═══ separator × 3                                → ~30  tokens
 *   Example block (ID, sender, JSON example)         → ~120 tokens
 *   Footer CRITICAL RULES block                      → ~80  tokens
 *   ──────────────────────────────────────────────────────────────
 *   Total overhead                                   ~280–350 tokens
 *
 * We use 600 as a conservative (generous) buffer so every chunk's full
 * formatted user prompt stays safely under MAX_EXTRACTION_INPUT_TOKENS.
 */
export const TOP_LEVEL_CHUNK_COUNT = parseInt(
  process.env.TOP_LEVEL_CHUNK_COUNT || '20',
  10
);

export const MAX_RECOVERY_DEPTH = parseInt(
  process.env.MAX_RECOVERY_DEPTH || '4',
  10
);

export const MAX_CONCURRENT_EXTRACTIONS = Math.max(
  1,
  parseInt(process.env.MAX_CONCURRENT_EXTRACTIONS || '2', 10)
);

export const GROQ_TPM_BUDGET = parseInt(
  process.env.GROQ_TPM_BUDGET || '12000',
  10
);

export const PROMPT_OVERHEAD_TOKENS = 600;

export const MAX_EXTRACTION_INPUT_TOKENS = parseInt(
  process.env.MAX_EXTRACTION_INPUT_TOKENS || '6000',
  10
);

export const MAX_MESSAGE_PAYLOAD_TOKENS =
  MAX_EXTRACTION_INPUT_TOKENS - PROMPT_OVERHEAD_TOKENS;

export const MAX_MESSAGES_PER_CHUNK = 2500;

export const MAX_EXTRACTION_CHUNKS = 40;

export const MAX_SINGLE_MESSAGE_TOKENS = 500;

export const MAX_MEMORY_TOKENS = 12000;

export const EXTRACTION_INPUT_SAFETY_RATIO = 0.85;

export const SAFE_EXTRACTION_INPUT_TOKENS = parseInt(
  process.env.SAFE_EXTRACTION_INPUT_TOKENS || '',
  10
) || Math.floor(MAX_EXTRACTION_INPUT_TOKENS * EXTRACTION_INPUT_SAFETY_RATIO);

// ─── Core Estimator ──────────────────────────────────────────────────────────

/**
 * Estimates the number of tokens in a string.
 *
 * Strategy:
 * - ASCII letters/digits/spaces: ~3.8 chars/token
 * - Non-ASCII (Hindi, Arabic, emoji, CJK, etc.): ~1.5 chars/token
 * - Adds a 10% safety buffer.
 *
 * @param {string} text
 * @returns {number} — estimated token count (rounded up)
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;

  let asciiCount = 0;
  let unicodeCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      asciiCount++;
    } else {
      unicodeCount++;
    }
  }

  const raw = asciiCount / 3.8 + unicodeCount / 1.5;
  // 10% safety buffer, minimum 1
  return Math.max(1, Math.ceil(raw * 1.1));
}

/**
 * Estimates the token count of a single message as it appears in the
 * extraction user prompt:
 *   "[msg_123] [2024-08-12T22:42:00.000Z] Sender: text\n"
 *
 * The timestamp is included because buildChunkExtractionUserPrompt
 * formats messages as: [id] [timestamp] sender: text
 *
 * @param {{ id: string, sender: string|null, timestamp?: string, text: string }} msg
 * @returns {number}
 */
export function estimateMessageTokens(msg) {
  const line = `[${msg.id}] [${msg.timestamp || ''}] ${msg.sender || 'Unknown'}: ${msg.text || ''}\n`;
  return estimateTokens(line);
}

/**
 * Estimates the total raw-message token count of an array of messages
 * as they would appear in the extraction user prompt (message block only,
 * does not include prompt overhead framing).
 *
 * @param {Array<{ id: string, sender: string|null, timestamp?: string, text: string }>} messages
 * @returns {number}
 */
export function estimateChunkPayloadTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }
  return total;
}

/**
 * Truncates a message's text to fit within MAX_SINGLE_MESSAGE_TOKENS.
 * Returns a new message object; never mutates the original.
 *
 * @param {{ id: string, sender: string|null, timestamp?: string, text: string, [key: string]: any }} msg
 * @returns {{ id: string, sender: string|null, timestamp?: string, text: string, [key: string]: any }}
 */
export function truncateMessageIfOversized(msg) {
  if (estimateMessageTokens(msg) <= MAX_SINGLE_MESSAGE_TOKENS) return msg;

  // Binary-search for the right truncation length
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

/**
 * Estimates the serialized token count of any JSON-serializable object.
 * Used to measure ChatMemory, prompts, etc.
 *
 * @param {any} obj
 * @returns {number}
 */
export function estimateObjectTokens(obj) {
  try {
    return estimateTokens(JSON.stringify(obj));
  } catch {
    return 0;
  }
}

export function estimateExtractionRequest(request) {
  const serializedRequest = JSON.stringify(request);
  const estimatedInputTokens = estimateTokens(serializedRequest);

  return {
    estimatedInputTokens,
    safeBudget: SAFE_EXTRACTION_INPUT_TOKENS,
    maxInputTokens: MAX_EXTRACTION_INPUT_TOKENS,
    safe: estimatedInputTokens <= SAFE_EXTRACTION_INPUT_TOKENS,
    totalSerializedRequestChars: serializedRequest.length,
    messageCount: Array.isArray(request?.messages) ? request.messages.length : 0,
  };
}
