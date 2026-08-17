import assert from 'node:assert/strict';
import { ChunkEvidenceSchema } from '../server/lib/ai/schemas/index.js';
import { RequestTooLargeError, getTokenTelemetry, resetTokenTelemetry } from '../server/lib/ai/groq.js';
import { extractSingleChunkWithRecovery } from '../server/lib/intelligence.js';
import {
  normalizeExtractionResult,
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

function parseNormalizedExtraction(types, chunkId = 'test_chunk') {
  return ChunkEvidenceSchema.parse(normalizeExtractionResult(makeExtraction(types), chunkId));
}

assert.equal(normalizeEvidenceType('love').type, 'love');
assert.equal(normalizeEvidenceType('Love').type, 'love');
assert.equal(normalizeEvidenceType(' reconciliation ').type, 'other');
assert.equal(normalizeEvidenceType('relationship-signal').type, 'relationship_signal');

const chunk = makeChunk('chunk_3ab', 11);
const parsed = parseNormalizedExtraction(['reconciliation'], 'chunk_3ab');
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
const mixed = validateChunkExtractionEvidence(parseNormalizedExtraction(mixedTypes, 'mixed_chunk'), chunk);
assert.equal(mixed.extraction.evidence.length, 11);
assert.equal(mixed.extraction.evidence[10].type, 'other');
assert.equal(mixed.extraction.evidence[10].original_type, ' reconciliation ');

const twentyOneTypes = Array.from({ length: 21 }, (_, index) =>
  index === 20 ? 'other' : 'turning_point'
);
const twentyOne = parseNormalizedExtraction(twentyOneTypes, 'overflow_21');
assert.equal(twentyOne.evidence.length, 20);
assert.equal(twentyOne._normalization.rawEvidenceItems, 21);
assert.equal(twentyOne._normalization.retainedEvidenceItems, 20);
assert.equal(twentyOne._normalization.discardedAfterRanking, 1);

const fifty = parseNormalizedExtraction(Array.from({ length: 50 }, () => 'event'), 'overflow_50');
assert.equal(fifty.evidence.length, 20);
assert.equal(fifty._normalization.rawEvidenceItems, 50);
assert.equal(fifty._normalization.discardedAfterRanking, 30);

const duplicateExtraction = makeExtraction(['event', 'event', 'plan']);
duplicateExtraction.evidence[1].messageId = duplicateExtraction.evidence[0].messageId;
duplicateExtraction.evidence[1].importance = 0.99;
const deduped = ChunkEvidenceSchema.parse(normalizeExtractionResult(duplicateExtraction, 'duplicate_chunk'));
assert.equal(deduped.evidence.length, 2);
assert.equal(deduped.evidence[0].messageId, 'm_001');
assert.equal(deduped.evidence[0].importance, 0.99);

const normalTen = parseNormalizedExtraction(Array.from({ length: 10 }, () => 'memorable'), 'normal_10');
assert.equal(normalTen.evidence.length, 10);
assert.equal(normalTen._normalization.discardedAfterRanking, 0);

resetTokenTelemetry();
const reconciliationProvider = {
  extractionModel: 'fake-extraction',
  calls: 0,
  async completeRequest({ normalizeResult, queueLabel }) {
    this.calls++;
    return ChunkEvidenceSchema.parse(normalizeResult(makeExtraction(['reconciliation']), queueLabel));
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
assert.equal(reconciliationProvider.calls, 1);

resetTokenTelemetry();
const overflowProvider = {
  extractionModel: 'fake-extraction',
  calls: 0,
  async completeRequest({ normalizeResult, queueLabel }) {
    this.calls++;
    return ChunkEvidenceSchema.parse(
      normalizeResult(makeExtraction(Array.from({ length: 50 }, () => 'event')), queueLabel)
    );
  },
};
const overflowResult = await extractSingleChunkWithRecovery(makeChunk('chunk_overflow', 50), 0, 1, overflowProvider);
const overflowTelemetry = getTokenTelemetry();
assert.equal(overflowResult.ok, true);
assert.equal(overflowResult.extraction.evidence.length, 20);
assert.equal(overflowProvider.calls, 1);
assert.equal(overflowTelemetry.totalRetries, 0);
assert.equal(overflowTelemetry.recoverySplits, 0);
assert.equal(overflowTelemetry.evidenceOverflowEvents, 1);
assert.equal(overflowTelemetry.evidenceItemsDiscardedAfterRanking, 30);

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
