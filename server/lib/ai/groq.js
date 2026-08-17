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

    // Two configurable model tiers
    const legacyDefault = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.extractionModel =
      process.env.GROQ_EXTRACTION_MODEL || legacyDefault;
    this.synthesisModel =
      process.env.GROQ_SYNTHESIS_MODEL || legacyDefault;

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

    const maxTokens = maxOutputTokens ?? 4096;
    const defaultTemp = tier === 'extraction' ? 0.1 : 0.75;
    const temp = typeof temperature === 'number' ? temperature : defaultTemp;

    return this.completeRequest({
      request: {
        model: useModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: temp,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
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
          // Reserve input + expected output tokens — Groq TPM counts both.
          // max_tokens defaults to 4096 if unset; use actual value when present.
          const expectedOutputTokens = request.max_tokens ?? 1200;
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

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty response from Groq');

        // Parse JSON
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[1]);
          } else {
            throw new Error(
              `Groq returned non-JSON content: ${content.slice(0, 200)}`
            );
          }
        }

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

        // Model not found (404) — abort immediately, do NOT retry
        if (
          status === 404 ||
          errMsg.includes('model_not_found') ||
          errMsg.includes('does not exist') ||
          errMsg.includes('Model not found')
        ) {
          telemetry.failedRequests++;
          throw new Error(
            `Configured Groq model "${useModel}" was not found (404). Please check GROQ_EXTRACTION_MODEL / GROQ_SYNTHESIS_MODEL in server/.env`
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

        // Network or 5xx — retry
        const isRetryable5xx =
          (status >= 500 && status < 600) ||
          errMsg.includes('timeout') ||
          errMsg.includes('network') ||
          errMsg.includes('ECONNRESET') ||
          errMsg.includes('ETIMEDOUT');

        if ((!isTPM && !isRetryable5xx) || attempt >= MAX_RETRIES) {
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
