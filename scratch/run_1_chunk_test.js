import fs from 'fs';
import { GroqProvider } from '../server/lib/ai/groq.js';
import { extractSingleChunkWithRecovery } from '../server/lib/intelligence.js';

// Load server/.env manually if dotenv is not installed/used in this runtime.
try {
  const envPath = new URL('../server/.env', import.meta.url);
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s]+)=(.*)$/);
    if (!m) return;
    const key = m[1].trim();
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  });
} catch (e) {
  // ignore — fallback to existing env
}

function makeChunk(id) {
  const messages = Array.from({ length: 8 }, (_, index) => ({
    id: `m_${String(index + 1).padStart(3, '0')}`,
    type: 'message',
    timestamp: `2025-01-01T00:${String(index).padStart(2, '0')}:00.000Z`,
    sender: index % 2 === 0 ? 'Asha' : 'Rahul',
    text: `Test message ${index + 1}`,
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
    console.error('GroqProvider init failed:', err.message);
    process.exit(1);
  }

  const chunk = makeChunk('test_chunk_1');
  try {
    const res = await extractSingleChunkWithRecovery(chunk, 0, 1, provider);
    console.log('Test extraction result ok:', res.ok);
    if (res.extraction) console.log('Extracted evidence count:', res.extraction.evidence?.length);
    if (res.extraction?._normalization) console.log('Normalization:', res.extraction._normalization);
  } catch (err) {
    console.error('Extraction failed:', err?.message || err);
    if (err?.error) console.error('API error:', JSON.stringify(err.error));
  }
}

run().catch(err => {
  console.error('Unexpected:', err);
  process.exit(1);
});
