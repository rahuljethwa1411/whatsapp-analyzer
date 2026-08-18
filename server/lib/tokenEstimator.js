import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_CONFIG } from './ai/modelConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

/**
 * Token Estimator for OpenAI Pipeline.
 *
 * Provides conservative character-based token estimation for WhatsApp messages and requests.
 * Accounts for:
 *   - System instructions
 *   - User prompt framing
 *   - Serialized messages
 *   - JSON Schema overhead
 *   - Expected output token allowance
 *   - Safety margin
 */

export const TOP_LEVEL_CHUNK_COUNT = parseInt(
  process.env.TOP_LEVEL_CHUNK_COUNT || String(DEFAULT_CONFIG.TOP_LEVEL_CHUNK_COUNT),
  10
);

export const MAX_RECOVERY_DEPTH = parseInt(
  process.env.MAX_RECOVERY_DEPTH || String(DEFAULT_CONFIG.MAX_RECOVERY_DEPTH),
  10
);

export const MAX_CONCURRENT_EXTRACTIONS = Math.max(
  1,
  parseInt(process.env.MAX_CONCURRENT_EXTRACTIONS || String(DEFAULT_CONFIG.MAX_CONCURRENT_EXTRACTIONS), 10)
);

export const PROMPT_OVERHEAD_TOKENS = 600;

export const MAX_EXTRACTION_INPUT_TOKENS = parseInt(
  process.env.MAX_EXTRACTION_INPUT_TOKENS || '16000',
  10
);

export const MAX_MESSAGE_PAYLOAD_TOKENS =
  MAX_EXTRACTION_INPUT_TOKENS - PROMPT_OVERHEAD_TOKENS;

export const MAX_MESSAGES_PER_CHUNK = 2500;

export const MAX_SINGLE_MESSAGE_TOKENS = 1500;

export const MAX_MEMORY_TOKENS = 16000;

export const EXTRACTION_INPUT_SAFETY_RATIO = 0.85;

export const SAFE_EXTRACTION_INPUT_TOKENS = parseInt(
  process.env.SAFE_EXTRACTION_INPUT_TOKENS || String(DEFAULT_CONFIG.SAFE_EXTRACTION_INPUT_TOKENS),
  10
);

export const EXTRACTION_MAX_OUTPUT_TOKENS = parseInt(
  process.env.EXTRACTION_MAX_OUTPUT_TOKENS || String(DEFAULT_CONFIG.EXTRACTION_MAX_OUTPUT_TOKENS),
  10
);

export const EVIDENCE_MAX_OUTPUT_TOKENS = parseInt(
  process.env.EVIDENCE_MAX_OUTPUT_TOKENS || String(DEFAULT_CONFIG.EVIDENCE_MAX_OUTPUT_TOKENS),
  10
);

export const STORY_MAX_OUTPUT_TOKENS = parseInt(
  process.env.STORY_MAX_OUTPUT_TOKENS || String(DEFAULT_CONFIG.STORY_MAX_OUTPUT_TOKENS),
  10
);

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
  return Math.max(1, Math.ceil(raw * 1.1));
}

/**
 * Estimates the token count of a single message as formatted in the extraction prompt.
 *
 * @param {{ id: string, sender: string|null, timestamp?: string, text: string }} msg
 * @returns {number}
 */
export function estimateMessageTokens(msg) {
  const line = `[${msg.id}] [${msg.timestamp || ''}] ${msg.sender || 'Unknown'}: ${msg.text || ''}\n`;
  return estimateTokens(line);
}

/**
 * Estimates the total raw-message token count of an array of messages.
 *
 * @param {Array<{ id: string, sender: string|null, timestamp?: string, text: string }>} messages
 * @returns {number}
 */
export function estimateChunkPayloadTokens(messages) {
  let total = 0;
  for (const msg of messages || []) {
    total += estimateMessageTokens(msg);
  }
  return total;
}

/**
 * Estimates the serialized token count of any JSON-serializable object.
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

/**
 * Preflight token estimation of a full extraction request.
 * Accounts for system prompt, user prompt framing, messages, schema overhead, and expected output allowance.
 *
 * @param {Object} request - Built extraction request object
 * @returns {Object} Diagnostics and safety check
 */
export function estimateExtractionRequest(request) {
  const systemContent = request?.messages?.find(m => m.role === 'system')?.content || '';
  const userContent = request?.messages?.find(m => m.role === 'user')?.content || '';
  const schemaTokens = request?.schema ? estimateObjectTokens(request.schema) : 200;
  const outputAllowance = request?.max_tokens || EXTRACTION_MAX_OUTPUT_TOKENS;

  const inputTokens = estimateTokens(systemContent) + estimateTokens(userContent) + schemaTokens;
  const totalTokens = inputTokens + outputAllowance;

  return {
    estimatedInputTokens: inputTokens,
    estimatedTotalTokens: totalTokens,
    safeBudget: SAFE_EXTRACTION_INPUT_TOKENS,
    maxInputTokens: MAX_EXTRACTION_INPUT_TOKENS,
    safe: inputTokens <= SAFE_EXTRACTION_INPUT_TOKENS,
    totalSerializedRequestChars: (systemContent + userContent).length,
    messageCount: Array.isArray(request?.messages) ? request.messages.length : 0,
  };
}
