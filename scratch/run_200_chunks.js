import { GroqProvider } from '../server/lib/ai/groq.js';
import { extractSingleChunkWithRecovery } from '../server/lib/intelligence.js';

function makeChunk(id, count, startIndex) {
  const messages = Array.from({ length: count }, (_, index) => ({
    id: `m_${String(startIndex + index + 1).padStart(6, '0')}`,
    type: 'message',
    timestamp: new Date(2025,0,1,0,0,startIndex + index).toISOString(),
    sender: (startIndex + index) % 3 === 0 ? 'Asha' : (startIndex + index) % 3 === 1 ? 'Rahul' : 'Maya',
    text: `Synthetic message ${startIndex + index + 1} — used for large-run extraction test.`,
  }));

  return {
    id,
    startAt: messages[0].timestamp,
    endAt: messages[messages.length - 1].timestamp,
    participants: Array.from(new Set(messages.map(m => m.sender))),
    messages,
  };
}

async function run() {
  let provider;
  try {
    provider = new GroqProvider();
  } catch (err) {
    console.error('GroqProvider init failed:', err?.message || err);
    process.exit(1);
  }

  const chunksToRun = 200;
  let globalIndex = 0;
  for (let i = 0; i < chunksToRun; i++) {
    // vary chunk size to mimic real world
    const size = 6 + Math.floor(Math.random() * 18); // 6..23
    const chunk = makeChunk(`full_chunk_${i + 1}`, size, globalIndex);
    globalIndex += size;
    console.log(`\n--- Extracting ${chunk.id} (${size} msgs) ---`);
    try {
      const res = await extractSingleChunkWithRecovery(chunk, i, chunksToRun, provider);
      console.log(`Chunk ${chunk.id} ok:`, res.ok, 'evidence retained:', (res.extraction?.evidence?.length || 0));
      if (res.extraction?._normalization) console.log('Normalization:', res.extraction._normalization);
    } catch (err) {
      console.error(`Chunk ${chunk.id} failed:`, err?.message || err);
    }
  }

  console.log('\nFinished 200-chunk extraction run.');
}

run().catch(err => {
  console.error('Unexpected failure:', err);
  process.exit(1);
});
