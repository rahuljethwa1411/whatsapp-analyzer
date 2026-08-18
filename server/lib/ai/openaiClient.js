/**
 * Centralized OpenAI Client & Telemetry Engine.
 *
 * Provides resilient, rate-limit-aware completions with:
 *   - Structured Outputs support (json_schema with strict schema validation)
 *   - Bounded exponential backoff with jitter and Retry-After header parsing
 *   - Tier-specific model routing and exact token telemetry
 *   - Provider-neutral error normalization
 */

import OpenAI from 'openai';
import { getModelForTier, validateModelConfig } from './modelConfig.js';

// ─── Custom Error Types ───────────────────────────────────────────────────────

export class DailyLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DailyLimitError';
    this.code = 'DAILY_LIMIT_EXCEEDED';
  }
}

export class InvalidApiKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidApiKeyError';
    this.code = 'INVALID_API_KEY';
  }
}

export class ModelNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelNotFoundError';
    this.code = 'MODEL_NOT_FOUND';
  }
}

export class RateLimitError extends Error {
  constructor(message, retryAfterSeconds = 0) {
    super(message);
    this.name = 'RateLimitError';
    this.code = 'RATE_LIMIT_EXCEEDED';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class RequestTooLargeError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'RequestTooLargeError';
    this.code = 'REQUEST_TOO_LARGE';
    this.telemetryRecorded = Boolean(options.telemetryRecorded);
  }
}

export class StructuredOutputError extends Error {
  constructor(message, rawResponse = null) {
    super(message);
    this.name = 'StructuredOutputError';
    this.code = 'STRUCTURED_OUTPUT_ERROR';
    this.rawResponse = rawResponse;
  }
}

// ─── Token & Cost Telemetry ──────────────────────────────────────────────────

// Pricing per 1M tokens (USD)
const MODEL_PRICING = {
  'gpt-4o-mini': { input: 0.15, cachedInput: 0.075, output: 0.60 },
  'gpt-5-mini': { input: 0.30, cachedInput: 0.15, output: 1.20 },
  'gpt-5.4-mini': { input: 0.50, cachedInput: 0.25, output: 2.00 },
  'gpt-4o': { input: 2.50, cachedInput: 1.25, output: 10.00 },
};

const telemetry = {
  provider: 'OpenAI',
  startTime: null,
  endTime: null,
  originalLogicalChunks: 0,
  successfulLogicalChunks: 0,
  recoveredLogicalChunks: 0,
  partiallyRecoveredChunks: 0,
  failedLogicalChunks: 0,
  physicalExtractionRequests: 0,
  recoverySplits: 0,
  retries: 0,
  rateLimit429s: 0,
  cacheHits: 0,
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  tierUsage: {
    extraction: { input: 0, cachedInput: 0, output: 0, total: 0, calls: 0 },
    evidence: { input: 0, cachedInput: 0, output: 0, total: 0, calls: 0 },
    story: { input: 0, cachedInput: 0, output: 0, total: 0, calls: 0 },
  },
  schemaNormalizationEvents: 0,
  unknownEvidenceTypesNormalized: 0,
  evidenceOverflowEvents: 0,
  evidenceItemsDiscardedAfterRanking: 0,
};

export function getTokenTelemetry() {
  const config = validateModelConfig().config || {};
  
  const calcCost = (tokens, pricing) => {
    const p = pricing || { input: 0.15, cachedInput: 0.075, output: 0.60 };
    const uncachedInput = Math.max(0, tokens.input - (tokens.cachedInput || 0));
    return (
      (uncachedInput / 1_000_000) * p.input +
      ((tokens.cachedInput || 0) / 1_000_000) * p.cachedInput +
      (tokens.output / 1_000_000) * p.output
    );
  };

  const extractionPricing = MODEL_PRICING[config.extractionModel] || MODEL_PRICING['gpt-4o-mini'];
  const evidencePricing = MODEL_PRICING[config.evidenceModel] || MODEL_PRICING['gpt-5-mini'];
  const storyPricing = MODEL_PRICING[config.storyModel] || MODEL_PRICING['gpt-5.4-mini'];

  const extractionCost = calcCost(telemetry.tierUsage.extraction, extractionPricing);
  const evidenceCost = calcCost(telemetry.tierUsage.evidence, evidencePricing);
  const storyCost = calcCost(telemetry.tierUsage.story, storyPricing);
  const totalCost = extractionCost + evidenceCost + storyCost;

  const elapsedMs = telemetry.startTime
    ? (telemetry.endTime ? telemetry.endTime - telemetry.startTime : Date.now() - telemetry.startTime)
    : 0;

  return {
    ...telemetry,
    extractionModel: config.extractionModel || 'gpt-4o-mini',
    evidenceModel: config.evidenceModel || 'gpt-5-mini',
    storyModel: config.storyModel || 'gpt-5.4-mini',
    costs: {
      extractionCostUsd: Number(extractionCost.toFixed(6)),
      evidenceCostUsd: Number(evidenceCost.toFixed(6)),
      storyCostUsd: Number(storyCost.toFixed(6)),
      totalCostUsd: Number(totalCost.toFixed(6)),
    },
    elapsedMs,
  };
}

export function resetTokenTelemetry() {
  telemetry.startTime = Date.now();
  telemetry.endTime = null;
  telemetry.originalLogicalChunks = 0;
  telemetry.successfulLogicalChunks = 0;
  telemetry.recoveredLogicalChunks = 0;
  telemetry.partiallyRecoveredChunks = 0;
  telemetry.failedLogicalChunks = 0;
  telemetry.physicalExtractionRequests = 0;
  telemetry.recoverySplits = 0;
  telemetry.retries = 0;
  telemetry.rateLimit429s = 0;
  telemetry.cacheHits = 0;
  telemetry.inputTokens = 0;
  telemetry.cachedInputTokens = 0;
  telemetry.outputTokens = 0;
  telemetry.totalTokens = 0;
  telemetry.tierUsage = {
    extraction: { input: 0, cachedInput: 0, output: 0, total: 0, calls: 0 },
    evidence: { input: 0, cachedInput: 0, output: 0, total: 0, calls: 0 },
    story: { input: 0, cachedInput: 0, output: 0, total: 0, calls: 0 },
  };
  telemetry.schemaNormalizationEvents = 0;
  telemetry.unknownEvidenceTypesNormalized = 0;
  telemetry.evidenceOverflowEvents = 0;
  telemetry.evidenceItemsDiscardedAfterRanking = 0;
}

export function recordExtractionRecoverySplit() {
  telemetry.recoverySplits += 1;
}

export function recordExtractionCacheHit() {
  telemetry.cacheHits += 1;
}

export function recordPartiallyRecoveredChunk() {
  telemetry.partiallyRecoveredChunks += 1;
}

export function recordExtractionSchemaNormalization(count = 1) {
  telemetry.schemaNormalizationEvents += count;
}

export function recordExtractionEvidenceOverflow(count = 1) {
  telemetry.evidenceOverflowEvents += 1;
  telemetry.evidenceItemsDiscardedAfterRanking += count;
}

// ─── Centralized OpenAI Client Instance ───────────────────────────────────────

let clientInstance = null;

export function getOpenAIClient() {
  if (!clientInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new InvalidApiKeyError('OPENAI_API_KEY is not set or is empty in server/.env');
    }
    clientInstance = new OpenAI({
      apiKey,
      timeout: 240000, // 4 minutes
    });
  }
  return clientInstance;
}

// ─── Helpers: Error Normalization & Retry ─────────────────────────────────────

function normalizeOpenAIError(err) {
  const status = err?.status || err?.response?.status;
  const message = err?.message || String(err);

  if (status === 401 || message.includes('Incorrect API key') || message.includes('invalid_api_key')) {
    return new InvalidApiKeyError(`Invalid OPENAI_API_KEY: ${message}`);
  }

  if (status === 404 || message.includes('model_not_found') || message.includes('does not exist')) {
    return new ModelNotFoundError(`Model not found or access denied: ${message}`);
  }

  if (status === 429 || message.includes('Rate limit') || message.includes('insufficient_quota')) {
    if (message.includes('insufficient_quota') || message.includes('quota exceeded')) {
      return new DailyLimitError(`OpenAI account quota exceeded. Please check billing: ${message}`);
    }
    const retryAfter = err?.headers?.['retry-after'] || err?.response?.headers?.['retry-after'];
    const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : 0;
    return new RateLimitError(message, retryAfterSec);
  }

  if (status === 400 && (message.includes('context_length_exceeded') || message.includes('maximum context length'))) {
    return new RequestTooLargeError(message);
  }

  return err;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Structured Output & Chat Completion Service ──────────────────────────────

export class OpenAIService {
  constructor() {
    this.client = getOpenAIClient();
  }

  /**
   * Executes a structured output completion with automatic backoff and error translation.
   *
   * @param {Object} options
   * @param {string} [options.model]
   * @param {'extraction'|'evidence'|'story'|'synthesis'} [options.tier]
   * @param {string} options.systemPrompt
   * @param {string} options.userPrompt
   * @param {Object|Function} [options.schema] - JSON Schema object or Zod Schema
   * @param {string} [options.schemaName]
   * @param {number} [options.temperature]
   * @param {number} [options.maxOutputTokens]
   * @param {number} [options.maxRetries]
   * @returns {Promise<Object>} Parsed JSON result
   */
  async completeStructured({
    model,
    tier = 'extraction',
    systemPrompt,
    userPrompt,
    schema = null,
    schemaName = 'StructuredOutput',
    temperature = 0.2,
    maxOutputTokens = 2000,
    maxRetries = 3,
  }) {
    const selectedModel = model || getModelForTier(tier);
    const messages = [];

    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    let responseFormat = { type: 'json_object' };
    if (schema) {
      const jsonSchemaObj = typeof schema.toJSON === 'function' ? schema.toJSON() : schema;
      // If it's already a complete json_schema object or raw schema
      if (jsonSchemaObj.type === 'object' || jsonSchemaObj.properties) {
        responseFormat = {
          type: 'json_schema',
          json_schema: {
            name: schemaName,
            strict: true,
            schema: jsonSchemaObj,
          },
        };
      }
    }

    let lastError = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        if (tier === 'extraction') {
          telemetry.physicalExtractionRequests += 1;
        }
        const effectiveTier = tier === 'synthesis' ? 'evidence' : tier;
        telemetry.tierUsage[effectiveTier].calls += 1;

        const requestPayload = {
          model: selectedModel,
          messages,
          response_format: responseFormat,
          max_completion_tokens: maxOutputTokens,
        };

        const isReasoningOrGpt5 =
          selectedModel.startsWith('gpt-5') ||
          selectedModel.startsWith('o1') ||
          selectedModel.startsWith('o3');

        if (typeof temperature === 'number' && !isReasoningOrGpt5) {
          requestPayload.temperature = temperature;
        }

        const response = await this.client.chat.completions.create(requestPayload);

        // Record actual token usage from OpenAI
        if (response.usage) {
          const input = response.usage.prompt_tokens || 0;
          const cached = response.usage.prompt_tokens_details?.cached_tokens || 0;
          const output = response.usage.completion_tokens || 0;
          const total = response.usage.total_tokens || (input + output);

          telemetry.inputTokens += input;
          telemetry.cachedInputTokens += cached;
          telemetry.outputTokens += output;
          telemetry.totalTokens += total;

          telemetry.tierUsage[effectiveTier].input += input;
          telemetry.tierUsage[effectiveTier].cachedInput += cached;
          telemetry.tierUsage[effectiveTier].output += output;
          telemetry.tierUsage[effectiveTier].total += total;
        }

        const choice = response.choices?.[0];
        const rawContent = choice?.message?.content;
        if (!rawContent) {
          if (choice?.message?.refusal) {
            throw new StructuredOutputError(`OpenAI refused request: ${choice.message.refusal}`);
          }
          if (choice?.finish_reason === 'length') {
            throw new StructuredOutputError(`OpenAI hit token limit (finish_reason=length).`);
          }
          throw new StructuredOutputError('OpenAI returned an empty response content.');
        }

        try {
          return JSON.parse(rawContent);
        } catch (jsonErr) {
          // Attempt markdown json block stripping
          const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
          return JSON.parse(cleaned);
        }
      } catch (err) {
        const normalized = normalizeOpenAIError(err);
        lastError = normalized;

        if (normalized instanceof InvalidApiKeyError || normalized instanceof ModelNotFoundError || normalized instanceof DailyLimitError || normalized instanceof RequestTooLargeError) {
          throw normalized;
        }

        if (normalized instanceof RateLimitError) {
          telemetry.rateLimit429s += 1;
          const delayMs = normalized.retryAfterSeconds > 0
            ? normalized.retryAfterSeconds * 1000
            : Math.min(20000, 1500 * Math.pow(2, attempt) + Math.random() * 1000);
          console.warn(`[OpenAI Rate Limit] Tier: ${tier} | Attempt ${attempt + 1}/${maxRetries + 1} | Waiting ${(delayMs / 1000).toFixed(1)}s`);
          await sleep(delayMs);
        } else {
          const isTransient = err?.status >= 500 || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNRESET' || err?.code === 'FETCH_ERROR';
          if (!isTransient || attempt >= maxRetries) {
            throw normalized;
          }
          const delayMs = Math.min(10000, 1000 * Math.pow(2, attempt) + Math.random() * 500);
          console.warn(`[OpenAI Transient Error] ${normalized.message} | Retrying in ${(delayMs / 1000).toFixed(1)}s`);
          await sleep(delayMs);
        }

        telemetry.retries += 1;
        attempt += 1;
      }
    }

    throw lastError;
  }

  /**
   * Generic completion adapter for provider interface compatibility.
   */
  async complete({
    systemPrompt,
    userPrompt,
    schema,
    tier = 'extraction',
    model,
    maxOutputTokens = 2000,
    temperature = 0.2,
  }) {
    return this.completeStructured({
      model,
      tier,
      systemPrompt,
      userPrompt,
      schema,
      temperature,
      maxOutputTokens,
    });
  }
}

let serviceInstance = null;

export function getOpenAIService() {
  if (!serviceInstance) {
    serviceInstance = new OpenAIService();
  }
  return serviceInstance;
}
