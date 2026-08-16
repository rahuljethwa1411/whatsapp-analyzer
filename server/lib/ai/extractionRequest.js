import {
  buildChunkExtractionSystemPrompt,
  buildChunkExtractionUserPrompt,
} from './prompts/chunkExtraction.js';
import { ChunkEvidenceSchema } from './schemas/index.js';

export function getExtractionModelName() {
  const legacyDefault = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  return process.env.GROQ_EXTRACTION_MODEL || legacyDefault;
}

export function buildExtractionRequest(chunk, chunkIndex, totalChunks, options = {}) {
  const model = options.model || getExtractionModelName();
  return {
    model,
    messages: [
      { role: 'system', content: buildChunkExtractionSystemPrompt() },
      { role: 'user', content: buildChunkExtractionUserPrompt(chunk, chunkIndex, totalChunks) },
    ],
    temperature: 0.1,
    max_tokens: options.maxOutputTokens ?? 1200,
    response_format: { type: 'json_object' },
  };
}

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
    systemPromptChars: systemPrompt.length,
    userPromptChars: userPrompt.length,
    schemaChars: 0,
    serializedMessagesChars: serializedMessages.length,
    totalSerializedRequestChars: JSON.stringify(request).length,
  };
}
