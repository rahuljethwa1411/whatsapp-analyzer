import { createChunks } from '../server/lib/chunker.js';

function makeMessages(n) {
  const messages = [];
  for (let i = 0; i < n; i++) {
    messages.push({
      id: `m_${String(i+1).padStart(6,'0')}`,
      type: 'message',
      timestamp: new Date(2025,0,1,0,0,i).toISOString(),
      sender: i % 2 === 0 ? 'Asha' : 'Rahul',
      text: 'This is a representative test message number ' + (i+1) + ' with some extra words to mimic real chat.',
    });
  }
  return messages;
}

const msgs = makeMessages(10000);
const chunks = createChunks([], msgs, { maxTokensPerChunk: undefined });
console.log('Created chunks:', chunks.length);
console.log('Sample chunk sizes:', chunks.slice(0,5).map(c=>c.messages.length));
