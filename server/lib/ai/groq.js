import Groq from 'groq-sdk';
import { AIProvider } from './provider.js';
import { estimateExtractionRequest } from '../tokenEstimator.js';
import { TokenAwareRequestQueue } from './tokenQueue.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1500;
const MAX_RETRY_AFTER_SECONDS = 30; // Never wait more than 30s for TPM backoff

// ─── Custom Error Types ───────────────────────────────────────────────────────

/**
 * Thrown when the daily token limit (TPD) is exhausted.
 * DO NOT retry — signal the user to come back tomorrow.
 */
export class DailyLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DailyLimitError';
    this.code = 'DAILY_LIMIT_EXCEEDED';
  }
}

/**
 * Thrown when the Groq API key is invalid or revoked.
 * DO NOT retry — fail immediately with instructions to fix server/.env.
 */
export class InvalidApiKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidApiKeyError';
    this.code = 'INVALID_API_KEY';
  }
}

/**
 * Thrown when a single request payload is too large.
 * DO NOT retry the same payload — split the chunk instead.
 */
export class RequestTooLargeError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'RequestTooLargeError';
    this.code = 'REQUEST_TOO_LARGE';
    this.telemetryRecorded = Boolean(options.telemetryRecorded);
  }
}

// ─── Token Telemetry ─────────────────────────────────────────────────────────

const telemetry = {
  originalLogicalChunks: 0,
  successfulLogicalChunks: 0,
  recoveredLogicalChunks: 0,
  partiallyRecoveredChunks: 0,
  failedLogicalChunks: 0,
  apiRequests: 0,
  apiRetries: 0,
  failedRequests: 0,
  cacheHits: 0,
  inputTokensEstimated: 0,
  inputTokensActual: 0,
  outputTokensActual: 0,
  extractionInputTokens: 0,
  extractionOutputTokens: 0,
  synthesisInputTokens: 0,
  synthesisOutputTokens: 0,
  totalRequests: 0,
  totalRetries: 0,
  rateLimitHits: 0,
  requestTooLargeHits: 0,
  recoverySplits: 0,
  schemaNormalizationEvents: 0,
  unknownEvidenceTypesNormalized: 0,
  evidenceOverflowEvents: 0,
  evidenceItemsDiscardedAfterRanking: 0,
  tpmBudget: 0,
  tpmTokensReserved: 0,
  tpmTokensAvailable: 0,
  requestsDelayedByTpm: 0,
  tpmQueueWaits: 0,
  totalTpmQueueWaitMs: 0,
  tpm429Retries: 0,
  totalQueueWaitMs: 0,
  maxQueueWaitMs: 0,
  queuedRequestsStarted: 0,
  activeExtractionRequests: 0,
};

export function getTokenTelemetry() {
  return { ...telemetry };
}

export function resetTokenTelemetry() {
  Object.keys(telemetry).forEach(k => (telemetry[k] = 0));
}

export function recordExtractionRecoverySplit() {
  telemetry.recoverySplits++;
}

export function recordExtractionSizeLimitHit() {
  telemetry.requestTooLargeHits++;
}

export function recordExtractionCacheHit() {
  telemetry.cacheHits++;
}

export function recordPartiallyRecoveredChunk() {
  telemetry.partiallyRecoveredChunks++;
}

export function recordExtractionSchemaNormalization(count = 1) {
  telemetry.schemaNormalizationEvents++;
  telemetry.unknownEvidenceTypesNormalized += count;
}

export function recordExtractionEvidenceOverflow(events = 0, discarded = 0) {
  telemetry.evidenceOverflowEvents += events;
  telemetry.evidenceItemsDiscardedAfterRanking += discarded;
}

function recordQueueStart(event) {
  telemetry.tpmBudget = event.snapshot.tpmBudget;
  telemetry.tpmTokensReserved = event.snapshot.reservedTokens;
  telemetry.tpmTokensAvailable = event.snapshot.availableTokens;
  telemetry.activeExtractionRequests = event.snapshot.activeRequests;
  telemetry.totalQueueWaitMs += event.waitMs || 0;
  telemetry.maxQueueWaitMs = Math.max(telemetry.maxQueueWaitMs, event.waitMs || 0);
  telemetry.queuedRequestsStarted++;
}

function recordQueueWait(event) {
  telemetry.tpmBudget = event.snapshot.tpmBudget;
  telemetry.tpmTokensReserved = event.snapshot.reservedTokens;
  telemetry.tpmTokensAvailable = event.snapshot.availableTokens;
  telemetry.activeExtractionRequests = event.snapshot.activeRequests;
  telemetry.requestsDelayedByTpm++;
  telemetry.tpmQueueWaits++;
  telemetry.totalTpmQueueWaitMs += event.waitMs || 0;
}

function recordQueueRelease(event) {
  telemetry.tpmBudget = event.snapshot.tpmBudget;
  telemetry.tpmTokensReserved = event.snapshot.reservedTokens;
  telemetry.tpmTokensAvailable = event.snapshot.availableTokens;
  telemetry.activeExtractionRequests = event.snapshot.activeRequests;
}

let extractionQueue = null;

function getExtractionQueue() {
  const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_EXTRACTIONS || '2', 10);
  const tokenBudget = parseInt(process.env.GROQ_TPM_BUDGET || '12000', 10);
  const windowMs = parseInt(process.env.GROQ_TPM_WINDOW_MS || '60000', 10);

  if (
    !extractionQueue ||
    extractionQueue.maxConcurrent !== Math.max(1, maxConcurrent) ||
    extractionQueue.tokenBudget !== Math.max(1, tokenBudget) ||
    extractionQueue.windowMs !== Math.max(1, windowMs)
  ) {
    extractionQueue = new TokenAwareRequestQueue({
      maxConcurrent,
      tokenBudget,
      windowMs,
      onEvent: event => {
        if (event.type === 'wait') {
          recordQueueWait(event);
          console.log(
            `⏳ [TPM-QUEUE] ${event.label} waiting for budget (needs ~${event.requestedTokens} tokens, available: ${event.snapshot.availableTokens}, active: ${event.snapshot.activeRequests}/${event.snapshot.maxConcurrent})`
          );
        } else if (event.type === 'start') {
          recordQueueStart(event);
          console.log(
            `⚡ [TPM-QUEUE] ${event.label} dispatched (reserved ~${event.reservedTokens} tokens, available: ${event.snapshot.availableTokens}, active: ${event.snapshot.activeRequests}/${event.snapshot.maxConcurrent})`
          );
        } else if (event.type === 'release') {
          recordQueueRelease(event);
        }
      },
    });
  }

  return extractionQueue;
}

// ─── GroqProvider ─────────────────────────────────────────────────────────────

/**
 * GroqProvider — wraps the Groq SDK.
 *
 * Two-tier model strategy:
 *   - tier: 'extraction' → GROQ_EXTRACTION_MODEL (small, fast, cheap)
 *   - tier: 'synthesis'  → GROQ_SYNTHESIS_MODEL  (strong, accurate)
 *
 * Smart retry:
 *   - TPM 429 (per-minute)   → exponential backoff, max 3 retries
 *   - TPD 429 (per-day)      → throws DailyLimitError immediately
 *   - 413 / request too large → throws RequestTooLargeError immediately
 *   - Other 4xx              → throws immediately (no retry)
 *   - 5xx / network          → limited exponential retry
 */
export class GroqProvider extends AIProvider {
  constructor() {
    super();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      throw new Error('GROQ_API_KEY is not configured. Set it in server/.env');
    }
    const baseURL = process.env.GROQ_BASE_URL || undefined;
    this.groq = new Groq({ apiKey, baseURL });

    // Two configurable model tiers — defaults to gpt-oss models
    this.extractionModel =
      process.env.GROQ_EXTRACTION_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    this.synthesisModel =
      process.env.GROQ_SYNTHESIS_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    console.log(
      `[Groq] Extraction model: ${this.extractionModel} | Synthesis model: ${this.synthesisModel}`
    );
  }

  /**
   * @param {{
   *   systemPrompt: string,
   *   userPrompt: string,
   *   schema: import('zod').ZodSchema,
   *   tier?: 'extraction' | 'synthesis',
   *   model?: string,
   *   maxOutputTokens?: number,
   *   temperature?: number,
   * }} options
   */
  async complete({ systemPrompt, userPrompt, schema, tier, model, maxOutputTokens, temperature }) {
    // Resolve model: explicit override > tier default > synthesis default
    let useModel = model;
    if (!useModel) {
      useModel =
        tier === 'extraction' ? this.extractionModel : this.synthesisModel;
    }

    // For extraction, cap max_tokens higher so there is room for both reasoning and JSON output.
    // gpt-oss thinking models consume reasoning tokens out of the same max_tokens budget;
    // too low a limit means they exhaust it mid-thought and never produce any JSON.
    const defaultMaxTokens = tier === 'extraction' ? 6000 : 4096;
    const maxTokens = maxOutputTokens ?? defaultMaxTokens;
    const defaultTemp = tier === 'extraction' ? 0.1 : 0.75;
    const temp = typeof temperature === 'number' ? temperature : defaultTemp;

    // gpt-oss models are thinking models — they reason then output JSON.
    // reasoning_effort:'low' on extraction minimises the thinking budget so the
    // bulk of max_tokens is available for the actual JSON output.
    // synthesis uses the default reasoning effort for better quality.
    const isGptOss = useModel.startsWith('openai/gpt-oss');
    const extraParams = isGptOss && tier === 'extraction'
      ? { reasoning_effort: 'low' }
      : {};

    return this.completeRequest({
      request: {
        model: useModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: temp,
        max_tokens: maxTokens,
        ...extraParams,
      },
      schema,
      tier,
    });
  }

  async completeRequest({ request, schema, tier, queueLabel, normalizeResult }) {
    const useModel = request.model;
    let lastError = null;
    let tokenInfo = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      telemetry.totalRequests++;
      let queueReservation = null;

      try {
        if (tier === 'extraction') {
          tokenInfo = estimateExtractionRequest(request);
          // Reserve input + REALISTIC expected output — not max_tokens (which is a ceiling).
          // Actual extraction output with reasoning_effort:'low' is ~300-800 tokens (compact JSON).
          // Over-reserving max_tokens (4096) causes a full 60s queue stall after every call.
          // Using 1200 lets the next call start as soon as actual usage clears the budget.
          const expectedOutputTokens = 1200;
          const totalReservation = tokenInfo.estimatedInputTokens + expectedOutputTokens;
          queueReservation = await getExtractionQueue().acquire(
            totalReservation,
            queueLabel || useModel
          );
        }

        const response = await this.groq.chat.completions.create(request);

        // ── Record actual token usage from response ───────────────────────
        const usage = response.usage;
        if (usage) {
          if (tier === 'extraction') {
            telemetry.extractionInputTokens += usage.prompt_tokens ?? 0;
            telemetry.extractionOutputTokens += usage.completion_tokens ?? 0;
          } else {
            telemetry.synthesisInputTokens += usage.prompt_tokens ?? 0;
            telemetry.synthesisOutputTokens += usage.completion_tokens ?? 0;
          }
        }

        // Reconcile queue reservation based on actual total tokens used
        if (queueReservation) {
          const actualTokens = usage
            ? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)
            : (tokenInfo?.estimatedInputTokens ?? null);
          try {
            queueReservation.release(actualTokens);
          } catch (e) {
            // Best-effort
          }
          queueReservation = null;
        }

        const message = response.choices?.[0]?.message;
        let content = message?.content;

        // gpt-oss / thinking models may include a reasoning preamble in message.content
        // before the actual JSON output. If content exists but contains no JSON object,
        // try to extract just the JSON portion embedded within it.
        if (content && typeof content === 'string' && content.trim()) {
          const firstBrace = content.indexOf('{');
          const lastBrace = content.lastIndexOf('}');
          if (firstBrace === -1 || lastBrace <= firstBrace) {
            // No JSON found in content — fall back to reasoning fields
            content = message?.reasoning || message?.reasoning_content || response.choices?.[0]?.text || '';
          } else if (firstBrace > 0) {
            // JSON is embedded after a thinking preamble — slice to the JSON portion
            content = content.slice(firstBrace);
          }
        } else {
          content = message?.reasoning || message?.reasoning_content || response.choices?.[0]?.text || '';
        }

        if (!content || typeof content !== 'string' || !content.trim()) {
          throw new Error('Empty response from Groq');
        }

        // Parse JSON with multi-layered extraction + aggressive repair
        let parsed = robustJsonParse(content, queueLabel || useModel);

        const resultForValidation =
          typeof normalizeResult === 'function'
            ? normalizeResult(parsed, queueLabel)
            : parsed;

        // Zod validation
        const validated = schema.parse(resultForValidation);
        return validated;

      } catch (err) {
        lastError = err;
        const status = err?.status ?? err?.error?.status;
        const errMsg = err?.message ?? '';
        logGroqErrorDebug(err, request, tier);

        // ── Classify error ────────────────────────────────────────────────

        // Model not found (404) or decommissioned — fail immediately, no silent fallback
        if (
          status === 404 ||
          (status === 400 && errMsg.includes('decommissioned')) ||
          errMsg.includes('model_not_found') ||
          errMsg.includes('does not exist') ||
          errMsg.includes('Model not found')
        ) {
          telemetry.failedRequests++;
          throw new Error(
            `Groq model "${useModel}" was not found. Check GROQ_EXTRACTION_MODEL / GROQ_SYNTHESIS_MODEL in server/.env`
          );
        }

        // Invalid API Key
        if (
          status === 401 ||
          errMsg.includes('Invalid API Key') ||
          errMsg.includes('invalid_api_key') ||
          errMsg.includes('Invalid API key')
        ) {
          telemetry.failedRequests++;
          throw new InvalidApiKeyError(
            'Invalid GROQ_API_KEY. Please verify your API key in server/.env or generate a new key at https://console.groq.com/keys'
          );
        }

        // Daily token limit exhausted (TPD)
        if (
          status === 429 &&
          (errMsg.includes('tokens per day') ||
            errMsg.includes('TPD') ||
            errMsg.includes('daily') ||
            (err?.error?.code === 'rate_limit_exceeded' &&
              errMsg.toLowerCase().includes('day')))
        ) {
          telemetry.failedRequests++;
          throw new DailyLimitError(
            'Daily Groq token limit reached. Please try again tomorrow. ' +
            'Consider upgrading to the Dev Tier for higher limits.'
          );
        }

        // TPM rate limit (per-minute 429) — retry with backoff, DO NOT treat as size error
        const isTPM =
          status === 429 ||
          errMsg.includes('tokens per minute') ||
          errMsg.includes('TPM') ||
          errMsg.includes('per minute') ||
          err?.error?.code === 'rate_limit_exceeded';

        // Genuine request/context size errors only (413 or non-429 context length exceeded).
        const normalizedError = errMsg.toLowerCase();
        const errorCode = String(err?.code ?? err?.error?.code ?? '').toLowerCase();
        const errorType = String(err?.type ?? err?.error?.type ?? '').toLowerCase();
        const isGenuineRequestSizeError =
          status === 413 ||
          (!isTPM && (
            errorCode.includes('context_length') ||
            errorCode.includes('request_too_large') ||
            errorType.includes('context_length') ||
            errorType.includes('request_too_large') ||
            normalizedError.includes('context window') ||
            normalizedError.includes('context length exceeded') ||
            normalizedError.includes('maximum context length')
          ));

        if (isGenuineRequestSizeError) {
          telemetry.failedRequests++;
          telemetry.requestTooLargeHits++;
          throw new RequestTooLargeError(
            `Groq request payload too large for model ${useModel}: ${errMsg.slice(0, 200)}`,
            { telemetryRecorded: true }
          );
        }

        // Network, 5xx, or empty/parsing hiccups — retryable
        const isRetryable5xx =
          (status >= 500 && status < 600) ||
          errMsg.includes('timeout') ||
          errMsg.includes('network') ||
          errMsg.includes('ECONNRESET') ||
          errMsg.includes('ETIMEDOUT');

        const isRetryableTransient =
          isTPM ||
          isRetryable5xx ||
          errMsg.includes('Empty response') ||
          errMsg.includes('non-JSON') ||
          errMsg.includes('Unexpected token');

        if (!isRetryableTransient || attempt >= MAX_RETRIES) {
          // Non-retryable OR exhausted retries
          telemetry.failedRequests++;
          break;
        }

        // Compute backoff delay
        let delay;
        if (isTPM) {
          telemetry.tpm429Retries++;
          telemetry.rateLimitHits++;
          const retryAfterRaw = err?.headers?.['retry-after'] || err?.response?.headers?.get?.('retry-after');
          let retryAfterSecs = retryAfterRaw ? parseInt(retryAfterRaw, 10) : 0;

          // Also check for "Please try again in X.XXs" in error message
          if (!retryAfterSecs) {
            const match = errMsg.match(/try again in (\d+(\.\d+)?)s/i);
            if (match) {
              retryAfterSecs = Math.ceil(parseFloat(match[1]));
            }
          }

          const cappedSecs = Math.min(
            retryAfterSecs || Math.pow(2, attempt + 1),
            MAX_RETRY_AFTER_SECONDS
          );
          delay = cappedSecs * 1000 + Math.random() * 400;
        } else {
          // 5xx — exponential with jitter
          delay =
            BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 300;
        }

        telemetry.totalRetries++;
        console.warn(
          `🔄 [GROQ RETRY] Attempt ${attempt + 1}/${MAX_RETRIES} failed (${isTPM ? 'TPM rate limit' : '5xx/network error'}). ` +
          `Retrying in ${Math.round(delay / 1000)}s — model: ${useModel}. Detail: ${errMsg.slice(0, 140)}`
        );
        if (queueReservation) {
          queueReservation.release();
          queueReservation = null;
        }
        await sleep(delay);
      } finally {
        if (queueReservation) queueReservation.release();
      }
    }

    throw lastError;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Multi-strategy JSON parser with aggressive repair.
 * Handles all observed failure modes from Groq LLM responses including:
 * - Truncated responses (hit max_tokens mid-array)
 * - Unescaped characters in string values (Hindi text, raw quotes, newlines)
 * - Partial corruption mid-array (valid items before the corruption point)
 *
 * @param {string} content - Raw response string from the model
 * @param {string} [label] - Chunk label for logging
 * @returns {any} - Parsed JavaScript object
 * @throws {Error} - If all strategies fail
 */
function robustJsonParse(content, label = '') {
  if (!content || typeof content !== 'string') {
    throw new Error('Empty response from Groq');
  }

  // Strategy 1: Direct parse (fast path — works for well-formed responses)
  try {
    return JSON.parse(content);
  } catch { /* try next */ }

  // Strategy 2: Extract from markdown code block
  const mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) {
    try { return JSON.parse(mdMatch[1]); } catch { /* try next */ }
  }

  // Extract the outermost JSON object for all remaining strategies
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`Groq returned non-JSON content: ${content.slice(0, 200)}`);
  }
  let candidate = content.slice(firstBrace, lastBrace + 1);

  // Strategy 3: Truncation repair (close unclosed brackets/braces)
  const repaired = repairTruncatedJson(candidate);
  if (repaired) {
    try {
      const parsed = JSON.parse(repaired);
      console.warn(`[Groq] Strategy 3 (truncation repair) succeeded for ${label}`);
      return parsed;
    } catch { /* try next */ }
  }

  // Strategy 4: Aggressive string sanitization
  // Handles unescaped quotes/newlines/control chars inside JSON string values
  try {
    const sanitized = sanitizeJsonStrings(candidate);
    const parsed = JSON.parse(sanitized);
    console.warn(`[Groq] Strategy 4 (string sanitization) succeeded for ${label}`);
    return parsed;
  } catch { /* try next */ }

  // Strategy 5: Partial evidence salvage
  // If the evidence array is corrupted mid-way, salvage complete items from it
  try {
    const salvaged = salvagePartialEvidenceArray(candidate);
    if (salvaged) {
      console.warn(`[Groq] Strategy 5 (partial salvage: ${salvaged.evidence?.length || 0} items) succeeded for ${label}`);
      return salvaged;
    }
  } catch { /* give up */ }

  throw new Error(`Groq returned unparseable JSON after all repair strategies: ${content.slice(0, 200)}`);
}

/**
 * Sanitizes JSON string values to remove or escape characters that break JSON.
 * Targets the most common corruption from LLM-generated content:
 * - Unescaped double quotes inside string values
 * - Literal newlines inside strings
 * - Control characters (0x00-0x1f)
 *
 * @param {string} json
 * @returns {string}
 */
function sanitizeJsonStrings(json) {
  // Use a state machine to find string boundaries, then sanitize within them
  let result = '';
  let i = 0;
  let inString = false;
  let escape = false;

  while (i < json.length) {
    const ch = json[i];

    if (escape) {
      result += ch;
      escape = false;
      i++;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      result += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        // Check if this quote is actually ending the string or is unescaped within it
        // Look ahead: a closing string quote is followed by :, ,, }, ], or whitespace+those
        const rest = json.slice(i + 1).replace(/^\s*/, '');
        const isClosing = rest.length === 0 || /^[,:}\]]/.test(rest);
        if (isClosing) {
          inString = false;
          result += ch;
        } else {
          // Unescaped quote inside string — escape it
          result += '\\"';
        }
      }
      i++;
      continue;
    }

    if (inString) {
      // Sanitize control chars and literal newlines inside string values
      const code = ch.charCodeAt(0);
      if (code === 0x0a) { result += '\\n'; }
      else if (code === 0x0d) { result += '\\r'; }
      else if (code === 0x09) { result += '\\t'; }
      else if (code < 0x20) { result += ' '; } // other control chars → space
      else { result += ch; }
    } else {
      result += ch;
    }
    i++;
  }
  return result;
}

/**
 * Last-resort: regex-extract complete evidence objects from a corrupted array.
 * Returns a minimal valid ChunkEvidence object with whatever items were valid.
 *
 * @param {string} json
 * @returns {Object|null}
 */
function salvagePartialEvidenceArray(json) {
  // Extract period, topics, recurringThemes from the outer object (usually intact)
  let period = { start: '', end: '' };
  let topics = [];
  let recurringThemes = [];

  try {
    const periodMatch = json.match(/"period"\s*:\s*\{[^}]*"start"\s*:\s*"([^"]*)"[^}]*"end"\s*:\s*"([^"]*)"/);
    if (periodMatch) period = { start: periodMatch[1], end: periodMatch[2] };

    const topicsMatch = json.match(/"topics"\s*:\s*(\[[^\]]*\])/);
    if (topicsMatch) topics = JSON.parse(topicsMatch[1]);

    const themesMatch = json.match(/"recurringThemes"\s*:\s*(\[[^\]]*\])/);
    if (themesMatch) recurringThemes = JSON.parse(themesMatch[1]);
  } catch { /* partial extraction is fine */ }

  // Extract individual evidence objects using a greedy regex
  // Each evidence item is: { "messageId": "...", "type": "...", "importance": N, "connection": "..." }
  const evidenceItems = [];
  // Match complete objects within the evidence array, stopping before any corruption
  const evidenceArrayMatch = json.match(/"evidence"\s*:\s*\[([\s\S]*)/);
  if (!evidenceArrayMatch) return null;

  const arrayContent = evidenceArrayMatch[1];
  // Match individual complete evidence objects (stops at first broken one)
  const itemRegex = /\{\s*"messageId"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"([^"]+)"\s*,\s*"importance"\s*:\s*([\d.]+)\s*(?:,\s*"connection"\s*:\s*"([^"]*)")?\s*\}/g;
  let match;
  while ((match = itemRegex.exec(arrayContent)) !== null) {
    evidenceItems.push({
      messageId: match[1],
      type: match[2],
      importance: parseFloat(match[3]),
      connection: match[4] || '',
    });
    if (evidenceItems.length >= 20) break;
  }

  if (evidenceItems.length === 0) return null;

  return { period, topics, recurringThemes, evidence: evidenceItems };
}

function repairTruncatedJson(json) {
  if (!json || typeof json !== 'string') return null;

  // Remove trailing commas before closing brackets (common truncation artifact)
  let s = json.replace(/,\s*$/, '');

  // Track open braces/brackets to know what needs closing
  const stack = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  if (stack.length === 0) return null; // Was already valid JSON (parse just failed for other reason)

  // Trim any partial value at the end (e.g. a dangling string or number)
  // Find last safe close point: last complete } or ]
  const lastClose = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastClose > 0) {
    s = s.slice(0, lastClose + 1);
  }

  // Re-compute stack after trimming
  const stack2 = [];
  inString = false;
  escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack2.push('}');
    else if (ch === '[') stack2.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack2.length && stack2[stack2.length - 1] === ch) stack2.pop();
    }
  }

  // Close any remaining open structures
  return s + stack2.reverse().join('');
}

function logGroqErrorDebug(err, request, tier) {
  if (process.env.TOKEN_ESTIMATOR_DEBUG !== '1') return;
  const status = err?.status ?? err?.error?.status ?? '';
  const code = err?.code ?? err?.error?.code ?? '';
  const type = err?.type ?? err?.error?.type ?? '';
  const message = String(err?.message ?? '').slice(0, 500);
  console.warn(
    '[Groq Error Debug]\n' +
    `tier: ${tier || ''}\n` +
    `model: ${request?.model || ''}\n` +
    `http_status: ${status}\n` +
    `error_code: ${code}\n` +
    `error_type: ${type}\n` +
    `error_message: ${message}`
  );
}
