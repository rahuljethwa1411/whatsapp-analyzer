/**
 * Token Estimator
 *
 * Conservative character-based token estimation for WhatsApp messages.
 * Real tokenizers are model-specific and not available client-side or in plain Node ESM.
 * We use ~3.5 chars/token for Latin text and ~1.5 chars/token for emoji/CJK/unicode.
 *
 * Target: stay comfortably under Groq TPM limits.
 * Always underestimate token count (i.e. our estimate should be >= real count).
 *
 * Budget constants — ALL other modules must import from here.
 */

// ─── Budget Constants ────────────────────────────────────────────────────────

/**
 * Maximum input tokens per extraction request.
 * This is the token budget for the USER PROMPT (raw messages) only.
 * System prompt + output overhead adds ~2000–3000 tokens on top.
 * Total request will be safely below 8k, far under the 12k TPM limit.
 */
export const MAX_EXTRACTION_INPUT_TOKENS = parseInt(
  process.env.MAX_EXTRACTION_INPUT_TOKENS || '2500',
  10
);

/**
 * Maximum message count per chunk.
 * Guarantees chunk payloads stay small and never trigger 413 / Request Too Large.
 */
export const MAX_MESSAGES_PER_CHUNK = 120;

/**
 * Maximum total extraction chunks allowed per chat analysis.
 * For massive chats (25k-50k+ messages), representative timeline sampling
 * ensures analysis completes in <25 seconds without hitting Groq TPM limits.
 */
export const MAX_EXTRACTION_CHUNKS = 20;

/**
 * If a single message exceeds this many tokens it gets truncated.
 * Protects against pathological messages (e.g. someone pasted an essay).
 */
export const MAX_SINGLE_MESSAGE_TOKENS = 500;

/**
 * Max tokens for the compact ChatMemory sent to the synthesis model.
 * Synthesis system prompt + output add ~3k–5k on top.
 */
export const MAX_MEMORY_TOKENS = 12000;

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
 * Estimates the token count of a minimal message payload
 * as it would appear in the extraction prompt:
 *   "[msg_123] Sender: text content here"
 *
 * @param {{ id: string, sender: string|null, text: string }} msg
 * @returns {number}
 */
export function estimateMessageTokens(msg) {
  // Format: "[id] sender: text\n"
  const line = `[${msg.id}] ${msg.sender || 'Unknown'}: ${msg.text || ''}\n`;
  return estimateTokens(line);
}

/**
 * Estimates the total token count of an array of messages
 * as they would appear in the extraction user prompt.
 *
 * @param {Array<{ id: string, sender: string|null, text: string }>} messages
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
 * @param {{ id: string, sender: string|null, text: string, [key: string]: any }} msg
 * @returns {{ id: string, sender: string|null, text: string, [key: string]: any }}
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
