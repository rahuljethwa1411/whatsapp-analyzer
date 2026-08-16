import Groq from 'groq-sdk';
import { AIProvider } from './provider.js';

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
  constructor(message) {
    super(message);
    this.name = 'RequestTooLargeError';
    this.code = 'REQUEST_TOO_LARGE';
  }
}

// ─── Token Telemetry ─────────────────────────────────────────────────────────

const telemetry = {
  extractionInputTokens: 0,
  extractionOutputTokens: 0,
  synthesisInputTokens: 0,
  synthesisOutputTokens: 0,
  totalRequests: 0,
  totalRetries: 0,
  failedRequests: 0,
  rateLimitHits: 0,
  requestTooLargeHits: 0,
};

export function getTokenTelemetry() {
  return { ...telemetry };
}

export function resetTokenTelemetry() {
  Object.keys(telemetry).forEach(k => (telemetry[k] = 0));
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
    this.groq = new Groq({ apiKey });

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
   * }} options
   */
  async complete({ systemPrompt, userPrompt, schema, tier, model, maxOutputTokens }) {
    // Resolve model: explicit override > tier default > synthesis default
    let useModel = model;
    if (!useModel) {
      useModel =
        tier === 'extraction' ? this.extractionModel : this.synthesisModel;
    }

    const maxTokens = maxOutputTokens ?? 4096;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      telemetry.totalRequests++;

      try {
        const response = await this.groq.chat.completions.create({
          model: useModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: tier === 'extraction' ? 0.1 : 0.3,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        });

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

        // Zod validation
        const validated = schema.parse(parsed);
        return validated;

      } catch (err) {
        lastError = err;
        const status = err?.status ?? err?.error?.status;
        const errMsg = err?.message ?? '';

        // ── Classify error ────────────────────────────────────────────────

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

        // Daily token limit exhausted
        if (
          status === 429 &&
          (errMsg.includes('tokens per day') ||
            errMsg.includes('TPD') ||
            errMsg.includes('daily') ||
            err?.error?.code === 'rate_limit_exceeded' &&
              errMsg.toLowerCase().includes('day'))
        ) {
          telemetry.failedRequests++;
          throw new DailyLimitError(
            'Daily Groq token limit reached. Please try again tomorrow. ' +
            'Consider upgrading to the Dev Tier for higher limits.'
          );
        }

        // Request too large (413 or TPM error caused by payload size)
        if (
          status === 413 ||
          errMsg.includes('Request too large') ||
          errMsg.includes('request too large') ||
          (status === 429 && errMsg.includes('Requested') && errMsg.includes('Limit'))
        ) {
          telemetry.failedRequests++;
          telemetry.requestTooLargeHits++;
          throw new RequestTooLargeError(
            `Groq request payload too large for model ${useModel}: ${errMsg.slice(0, 200)}`
          );
        }

        // TPM rate limit (per-minute) — retry with backoff
        const isTPM =
          status === 429 &&
          (errMsg.includes('tokens per minute') ||
            errMsg.includes('TPM') ||
            errMsg.includes('per minute'));

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
          telemetry.rateLimitHits++;
          const retryAfterRaw = err?.headers?.['retry-after'];
          const retryAfterSecs = retryAfterRaw
            ? parseInt(retryAfterRaw, 10)
            : 0;
          // Cap at MAX_RETRY_AFTER_SECONDS, use exponential with jitter if no header
          const cappedSecs = Math.min(
            retryAfterSecs || Math.pow(2, attempt + 1),
            MAX_RETRY_AFTER_SECONDS
          );
          delay = cappedSecs * 1000 + Math.random() * 500; // jitter
        } else {
          // 5xx — exponential with jitter
          delay =
            BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 300;
        }

        telemetry.totalRetries++;
        console.warn(
          `[Groq] Attempt ${attempt + 1}/${MAX_RETRIES} failed (${isTPM ? 'TPM rate limit' : '5xx/network'}). ` +
          `Retrying in ${Math.round(delay / 1000)}s — model: ${useModel}. Error: ${errMsg.slice(0, 120)}`
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
