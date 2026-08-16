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
export const PROMPT_OVERHEAD_TOKENS = 600;

/**
 * Maximum tokens for the FULL extraction user prompt
 * (raw message block + all prompt framing).
 *
 * Set to 4000. With the system prompt (~250 tokens) and output (1200 tokens),
 * the total Groq request stays ~5450 tokens — well within the model's 8192
 * context window and the 6000 TPM rate limit.
 *
 * Override with MAX_EXTRACTION_INPUT_TOKENS env var.
 */
export const MAX_EXTRACTION_INPUT_TOKENS = parseInt(
  process.env.MAX_EXTRACTION_INPUT_TOKENS || '4000',
  10
);

/**
 * Effective token budget for the RAW MESSAGE BLOCK only inside one chunk.
 * = MAX_EXTRACTION_INPUT_TOKENS - PROMPT_OVERHEAD_TOKENS
 *
 * The chunker uses this number when packing messages so that the full
 * formatted prompt never exceeds MAX_EXTRACTION_INPUT_TOKENS.
 */
export const MAX_MESSAGE_PAYLOAD_TOKENS =
  MAX_EXTRACTION_INPUT_TOKENS - PROMPT_OVERHEAD_TOKENS;

/**
 * Hard maximum message count per chunk.
 * Prevents any single chunk from being unreasonably large even if
 * individual messages are very short.
 */
export const MAX_MESSAGES_PER_CHUNK = 120;

/**
 * Maximum total extraction chunks allowed per chat analysis.
 * This is now a WARNING threshold only — NOT a hard downsampling cap.
 * Messages are never discarded to meet this limit.
 */
export const MAX_EXTRACTION_CHUNKS = 60;

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
export const EXTRACTION_INPUT_SAFETY_RATIO = 0.82;
export const SAFE_EXTRACTION_INPUT_TOKENS = Math.floor(
  MAX_EXTRACTION_INPUT_TOKENS * EXTRACTION_INPUT_SAFETY_RATIO
);

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
  const messages = Array.isArray(request?.messages) ? request.messages : [];

  let conversationalTokens = 0;
  for (const message of messages) {
    conversationalTokens += estimateTokens(String(message?.role || ''));
    conversationalTokens += estimateTokens(String(message?.content || ''));
    // ChatML-like framing overhead. Groq's exact tokenizer is not available
    // locally, so this is a documented conservative allowance per message.
    conversationalTokens += 8;
  }

  const tokenRelevantRequest = {
    ...request,
    messages: messages.map(message => ({
      role: message?.role || '',
      content: '',
    })),
  };
  const structuralTokens = estimateTokens(JSON.stringify(tokenRelevantRequest));
  const escapingOverheadTokens = Math.ceil(
    Math.max(0, serializedRequest.length - messages.reduce(
      (sum, message) => sum + String(message?.content || '').length,
      0
    )) / 4
  );

  const estimatedInputTokens = Math.ceil(
    (conversationalTokens + structuralTokens + escapingOverheadTokens) * 1.18
  );

  return {
    estimatedInputTokens,
    safeBudget: SAFE_EXTRACTION_INPUT_TOKENS,
    maxInputTokens: MAX_EXTRACTION_INPUT_TOKENS,
    safe: estimatedInputTokens <= SAFE_EXTRACTION_INPUT_TOKENS,
    totalSerializedRequestChars: serializedRequest.length,
    messageCount: messages.length,
  };
}
