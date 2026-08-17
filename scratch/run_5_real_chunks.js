import { GroqProvider } from '../server/lib/ai/groq.js';
import { extractSingleChunkWithRecovery } from '../server/lib/intelligence.js';

function makeChunk(id, count) {
  const messages = Array.from({ length: count }, (_, index) => ({
    id: `m_${String(index + 1).padStart(3, '0')}`,
    type: 'message',
    timestamp: `2025-01-01T00:${String(index).padStart(2, '0')}:00.000Z`,
    sender: index % 2 === 0 ? 'Asha' : 'Rahul',
    text: `Message ${index + 1} — this is a short test message to exercise extraction.`,
  }));

  return {
    id,
    startAt: messages[0].timestamp,
    endAt: messages[messages.length - 1].timestamp,
    participants: ['Asha', 'Rahul'],
    messages,
  };
}

async function run() {
  let provider;
  try {
    provider = new GroqProvider();
  } catch (err) {
    console.error('GroqProvider initialization failed:', err.message);
    process.exit(1);
  }

  const chunkSizes = [8, 12, 22, 6, 18];
  for (let i = 0; i < chunkSizes.length; i++) {
    const chunk = makeChunk(`real_chunk_${i + 1}`, chunkSizes[i]);
    console.log(`\n--- Extracting ${chunk.id} (${chunkSizes[i]} messages) ---`);
    try {
      const res = await extractSingleChunkWithRecovery(chunk, i, chunkSizes.length, provider);
      console.log('Result ok:', res.ok, 'retained evidence:', res.extraction?.evidence?.length || 0);
      if (res.extraction?._normalization) console.log('Normalization:', res.extraction._normalization);
    } catch (err) {
      console.error(`Chunk ${chunk.id} failed:`, err?.message || err);
    }
  }
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
