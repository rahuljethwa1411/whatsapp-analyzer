import {
  buildChunkExtractionSystemPrompt,
  buildChunkExtractionUserPrompt,
} from './prompts/chunkExtraction.js';
import { getModelForTier } from './modelConfig.js';
import { EXTRACTION_MAX_OUTPUT_TOKENS } from '../tokenEstimator.js';

// ─── Strict JSON Schema for OpenAI Structured Outputs ─────────────────────────

export const CHUNK_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    period: {
      type: 'object',
      properties: {
        start: { type: 'string' },
        end: { type: 'string' },
      },
      required: ['start', 'end'],
      additionalProperties: false,
    },
    topics: {
      type: 'array',
      items: { type: 'string' },
    },
    recurringThemes: {
      type: 'array',
      items: { type: 'string' },
    },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          messageId: { type: 'string' },
          type: { type: 'string' },
          importance: { type: 'number' },
          connection: { type: 'string' },
        },
        required: ['messageId', 'type', 'importance', 'connection'],
        additionalProperties: false,
      },
    },
  },
  required: ['period', 'topics', 'recurringThemes', 'evidence'],
  additionalProperties: false,
};

// ─── Request Builder ──────────────────────────────────────────────────────────

/**
 * Builds the OpenAI API request for chunk extraction.
 *
 * @param {Object} chunk - Logical or recovery subchunk
 * @param {number} chunkIndex
 * @param {number} totalChunks
 * @param {Object} [options]
 * @returns {Object}
 */
export function buildExtractionRequest(chunk, chunkIndex, totalChunks, options = {}) {
  const model = options.model || getModelForTier('extraction');
  const maxTokens = options.maxOutputTokens ?? EXTRACTION_MAX_OUTPUT_TOKENS;

  return {
    model,
    messages: [
      { role: 'system', content: buildChunkExtractionSystemPrompt() },
      { role: 'user', content: buildChunkExtractionUserPrompt(chunk, chunkIndex, totalChunks) },
    ],
    schema: CHUNK_EXTRACTION_JSON_SCHEMA,
    schemaName: 'ChunkEvidenceExtraction',
    temperature: 0.1,
    max_tokens: maxTokens,
  };
}

export function getExtractionSchema() {
  return CHUNK_EXTRACTION_JSON_SCHEMA;
}

export function getExtractionRequestDiagnostics(request, chunk) {
  const systemPrompt = request.messages?.find((m) => m.role === 'system')?.content || '';
  const userPrompt = request.messages?.find((m) => m.role === 'user')?.content || '';
  const serializedMessages = (chunk?.messages || [])
    .filter((m) => m.type === 'message')
    .map((m) => `[${m.id}] [${m.timestamp}] ${m.sender || 'Unknown'}: ${m.text}`)
    .join('\n');

  return {
    chunk: chunk?.id || '',
    messages: (chunk?.messages || []).filter((m) => m.type === 'message').length,
    model: request.model,
    maxTokens: request.max_tokens,
    systemPromptChars: systemPrompt.length,
    userPromptChars: userPrompt.length,
    serializedMessagesChars: serializedMessages.length,
    totalSerializedRequestChars: JSON.stringify(request).length,
  };
}
