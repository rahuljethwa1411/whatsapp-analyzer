import { extractSingleChunkWithRecovery } from '../server/lib/intelligence.js';
import { ChunkEvidenceSchema } from '../server/lib/ai/schemas/index.js';
import { normalizeExtractionResult } from '../server/lib/evidence.js';

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

function makeExtraction(evidenceCount) {
  return {
    period: { start: '2025-01-01T00:00:00.000Z', end: '2025-01-01T00:10:00.000Z' },
    topics: ['sim'],
    recurringThemes: [],
    evidence: Array.from({ length: evidenceCount }).map((_, i) => ({
      messageId: `m_${String(i + 1).padStart(3, '0')}`,
      type: i % 7 === 0 ? 'reconciliation' : 'event',
      importance: 0.8 - (i * 0.001),
      connection: `e${i + 1}`,
    })),
  };
}

async function run() {
  const counts = [11, 21, 50, 5, 25];
  for (let i = 0; i < counts.length; i++) {
    const id = `sim_chunk_${i + 1}`;
    const chunk = makeChunk(id, Math.min(30, counts[i]));
    const provider = {
      extractionModel: 'fake-extraction',
      async completeRequest({ normalizeResult, queueLabel }) {
        // Return a parsed, normalized extraction with the requested number of items
        const raw = makeExtraction(counts[i]);
        return ChunkEvidenceSchema.parse(normalizeResult(raw, queueLabel));
      },
    };

    console.log(`\n--- Running ${id} (${counts[i]} evidence) ---`);
    const res = await extractSingleChunkWithRecovery(chunk, i, counts.length, provider);
    console.log('ok:', res.ok, 'retained:', res.extraction?.evidence?.length || 0);
    if (res.extraction && res.extraction._normalization) {
      console.log('normalization:', res.extraction._normalization);
    }
  }
}

run().catch(err => {
  console.error('Error during simulation:', err);
  process.exit(1);
});
