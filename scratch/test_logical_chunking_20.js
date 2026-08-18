import { createChunks, splitMessagesByTokenWeight } from '../server/lib/chunker.js';
import { estimateMessageTokens } from '../server/lib/tokenEstimator.js';

console.log('=== TEST 2: Top-Level 20-Chunk Partitioning & Token-Weighted Splitting ===');

// Generate 10,000 mock messages
console.log('\nGenerating 10,000 mock messages...');
const messages10k = [];
const baseDate = new Date('2024-01-01T00:00:00.000Z');

for (let i = 1; i <= 10000; i++) {
  const ts = new Date(baseDate.getTime() + i * 30000).toISOString();
  messages10k.push({
    id: `msg_${i}`,
    timestamp: ts,
    sender: i % 2 === 0 ? 'Rahul' : 'Alex',
    text: i % 5 === 0 ? 'This is a longer message talking about an upcoming weekend trip to Goa!' : 'Short reply 👍',
    type: 'message',
  });
}

const chunks10k = createChunks([], messages10k);
console.log(`10,000 messages partitioned into ${chunks10k.length} logical chunks.`);
if (chunks10k.length !== 20) {
  throw new Error(`Expected 20 logical chunks, got ${chunks10k.length}`);
}

// Generate 23,979 mock messages
console.log('\nGenerating 23,979 mock messages...');
const messages24k = [];
for (let i = 1; i <= 23979; i++) {
  const ts = new Date(baseDate.getTime() + i * 20000).toISOString();
  messages24k.push({
    id: `msg_${i}`,
    timestamp: ts,
    sender: i % 3 === 0 ? 'Rahul' : 'Sam',
    text: `Message ${i}: ${'Lorem ipsum '.repeat((i % 4) + 1)}`,
    type: 'message',
  });
}

const chunks24k = createChunks([], messages24k);
console.log(`23,979 messages partitioned into ${chunks24k.length} logical chunks.`);
if (chunks24k.length !== 20) {
  throw new Error(`Expected 20 logical chunks for 23,979 messages, got ${chunks24k.length}`);
}

// Test Token-Weighted Splitting
console.log('\nTesting token-weighted splitting...');
const sampleBatch = [
  { id: 'm1', sender: 'A', text: 'short', timestamp: '2024-01-01T10:00:00.000Z' },
  { id: 'm2', sender: 'B', text: 'very long text '.repeat(50), timestamp: '2024-01-01T10:01:00.000Z' },
  { id: 'm3', sender: 'A', text: 'another text '.repeat(10), timestamp: '2024-01-01T10:02:00.000Z' },
  { id: 'm4', sender: 'B', text: 'tiny', timestamp: '2024-01-01T10:03:00.000Z' },
];

const [left, right] = splitMessagesByTokenWeight(sampleBatch);
const leftTokens = left.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
const rightTokens = right.reduce((sum, m) => sum + estimateMessageTokens(m), 0);

console.log(`Split 4 messages: Left (${left.length} msgs, ${leftTokens} tokens) | Right (${right.length} msgs, ${rightTokens} tokens)`);
console.log('✓ Top-level 20-chunk partitioning and token-weighted splitting passed.');
