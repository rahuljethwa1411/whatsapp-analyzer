import assert from 'node:assert/strict';
import { ChunkEvidenceSchema } from '../server/lib/ai/schemas/index.js';
import { RequestTooLargeError, getTokenTelemetry, resetTokenTelemetry } from '../server/lib/ai/groq.js';
import { extractSingleChunkWithRecovery } from '../server/lib/intelligence.js';
import {
  normalizeEvidenceType,
  validateChunkExtractionEvidence,
} from '../server/lib/evidence.js';

function makeChunk(id, count) {
  const messages = Array.from({ length: count }, (_, index) => ({
    id: `m_${String(index + 1).padStart(3, '0')}`,
    type: 'message',
    timestamp: `2025-01-01T00:${String(index).padStart(2, '0')}:00.000Z`,
    sender: index % 2 === 0 ? 'Asha' : 'Rahul',
    text: `Message ${index + 1}`,
  }));

  return {
    id,
    startAt: messages[0].timestamp,
    endAt: messages[messages.length - 1].timestamp,
    participants: ['Asha', 'Rahul'],
    messages,
  };
}

function makeExtraction(types) {
  return {
    period: {
      start: '2025-01-01T00:00:00.000Z',
      end: '2025-01-01T00:10:00.000Z',
    },
    topics: ['normalization'],
    recurringThemes: [],
    evidence: types.map((type, index) => ({
      messageId: `m_${String(index + 1).padStart(3, '0')}`,
      type,
      importance: 0.8,
      connection: `Evidence ${index + 1}`,
    })),
  };
}

assert.equal(normalizeEvidenceType('love').type, 'love');
assert.equal(normalizeEvidenceType('Love').type, 'love');
assert.equal(normalizeEvidenceType(' reconciliation ').type, 'other');
assert.equal(normalizeEvidenceType('relationship-signal').type, 'relationship_signal');

const chunk = makeChunk('chunk_3ab', 11);
const parsed = ChunkEvidenceSchema.parse(makeExtraction(['reconciliation']));
const single = validateChunkExtractionEvidence(parsed, chunk);
assert.equal(single.extraction.evidence.length, 1);
assert.equal(single.extraction.evidence[0].type, 'other');
assert.equal(single.extraction.evidence[0].original_type, 'reconciliation');

const mixedTypes = [
  'love',
  'Love',
  'conflict',
  'plan',
  'funny',
  'relationship_signal',
  'inside_joke',
  'promise',
  'event',
  'memorable',
  ' reconciliation ',
];
const mixed = validateChunkExtractionEvidence(ChunkEvidenceSchema.parse(makeExtraction(mixedTypes)), chunk);
assert.equal(mixed.extraction.evidence.length, 11);
assert.equal(mixed.extraction.evidence[10].type, 'other');
assert.equal(mixed.extraction.evidence[10].original_type, ' reconciliation ');

resetTokenTelemetry();
const reconciliationProvider = {
  extractionModel: 'fake-extraction',
  async completeRequest() {
    return makeExtraction(['reconciliation']);
  },
};
const pipelineResult = await extractSingleChunkWithRecovery(makeChunk('chunk_3ab', 1), 0, 1, reconciliationProvider);
const normalizationTelemetry = getTokenTelemetry();
assert.equal(pipelineResult.ok, true);
assert.equal(pipelineResult.extraction.evidence.length, 1);
assert.equal(pipelineResult.extraction.evidence[0].type, 'other');
assert.equal(pipelineResult.extraction.evidence[0].original_type, 'reconciliation');
assert.equal(normalizationTelemetry.schemaNormalizationEvents, 1);
assert.equal(normalizationTelemetry.unknownEvidenceTypesNormalized, 1);

assert.throws(() => ChunkEvidenceSchema.parse({ evidence: 'not an array' }));

resetTokenTelemetry();
const provider = {
  extractionModel: 'fake-extraction',
  async completeRequest() {
    throw new RequestTooLargeError('RequestTooLargeError: still too large');
  },
};
const sizeResult = await extractSingleChunkWithRecovery(makeChunk('size_chunk', 1), 0, 1, provider);
const telemetry = getTokenTelemetry();
assert.equal(sizeResult.ok, false);
assert.equal(telemetry.recoverySplits, 0);
assert.equal(telemetry.unknownEvidenceTypesNormalized, 0);
assert.equal(telemetry.requestTooLargeHits, 1);

console.log('extraction schema normalization tests passed');
