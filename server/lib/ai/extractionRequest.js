import {
  buildChunkExtractionSystemPrompt,
  buildChunkExtractionUserPrompt,
} from './prompts/chunkExtraction.js';
import { ChunkEvidenceSchema } from './schemas/index.js';

// ─── Model helpers ────────────────────────────────────────────────────────────

export function getExtractionModelName() {
  return (
    process.env.GROQ_EXTRACTION_MODEL ||
    process.env.GROQ_MODEL ||
    'openai/gpt-oss-20b'
  );
}

/**
 * Returns true when the model is a gpt-oss thinking model.
 * Thinking models reason internally before outputting JSON, so:
 *   - Do NOT set response_format: json_object (causes 400s)
 *   - Set reasoning_effort: 'low' for extraction to preserve token budget
 *   - Use a larger max_tokens to give room for both reasoning + JSON output
 */
function isThinkingModel(model) {
  return model.startsWith('openai/gpt-oss');
}

// ─── Request builder ──────────────────────────────────────────────────────────

/**
 * Builds the raw Groq API request for chunk extraction.
 *
 * max_tokens for thinking models must be large enough for reasoning + JSON output.
 * 4096 is fine — with reasoning_effort:'low', actual reasoning is minimal,
 * and the JSON output for ≤20 evidence items is typically 800-1500 tokens.
 */
export function buildExtractionRequest(chunk, chunkIndex, totalChunks, options = {}) {
  const model = options.model || getExtractionModelName();
  const thinking = isThinkingModel(model);

  // Thinking models need headroom for internal reasoning + JSON output.
  // reasoning_effort:'low' keeps actual reasoning minimal (~200-500 tokens),
  // so 2048 is plenty for reasoning + compact JSON output (≤20 evidence items).
  // Non-thinking models only need budget for JSON output (~800-1200 tokens).
  const maxTokens = options.maxOutputTokens ?? (thinking ? 2048 : 1200);

  const request = {
    model,
    messages: [
      { role: 'system', content: buildChunkExtractionSystemPrompt() },
      { role: 'user', content: buildChunkExtractionUserPrompt(chunk, chunkIndex, totalChunks) },
    ],
    temperature: 0.1,
    max_tokens: maxTokens,
  };

  // Thinking models: use reasoning_effort:'low' so minimal tokens go to
  // reasoning and the bulk of max_tokens remains for JSON output.
  // Do NOT set response_format — thinking models produce mixed content.
  if (thinking) {
    request.reasoning_effort = 'low';
  }

  return request;
}

// ─── Schema / diagnostics ─────────────────────────────────────────────────────

export function getExtractionSchema() {
  return ChunkEvidenceSchema;
}

export function getExtractionRequestDiagnostics(request, chunk) {
  const systemPrompt = request.messages?.find(m => m.role === 'system')?.content || '';
  const userPrompt = request.messages?.find(m => m.role === 'user')?.content || '';
  const serializedMessages = (chunk?.messages || [])
    .filter(m => m.type === 'message')
    .map(m => `[${m.id}] [${m.timestamp}] ${m.sender || 'Unknown'}: ${m.text}`)
    .join('\n');

  return {
    chunk: chunk?.id || '',
    messages: (chunk?.messages || []).filter(m => m.type === 'message').length,
    model: request.model,
    reasoningEffort: request.reasoning_effort || 'default',
    maxTokens: request.max_tokens,
    systemPromptChars: systemPrompt.length,
    userPromptChars: userPrompt.length,
    schemaChars: 0,
    serializedMessagesChars: serializedMessages.length,
    totalSerializedRequestChars: JSON.stringify(request).length,
  };
}
