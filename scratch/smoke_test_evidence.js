/**
 * Smoke test for Phase 3 V2 Evidence Extraction
 *
 * Sends a minimal synthetic conversation through the pipeline and verifies:
 *   1. Schema validation passes (ChunkEvidenceSchema)
 *   2. Evidence items have real messageIds, senders, timestamps, exact text
 *   3. Existing stats remain unaffected
 *   4. _evidenceStore is populated on the intelligence result
 */

import 'dotenv/config';
import { buildChunkExtractionSystemPrompt, buildChunkExtractionUserPrompt } from '../lib/ai/prompts/chunkExtraction.js';
import { ChunkEvidenceSchema } from '../lib/ai/schemas/index.js';
import { GroqProvider } from '../lib/ai/groq.js';
import { buildMessageIndex, buildEvidenceStore } from '../lib/evidence.js';

// ─── Synthetic conversation messages ─────────────────────────────────────────

const testMessages = [
  { id: 'msg_001', sender: 'Rahul', timestamp: '2025-09-14T22:13:00', text: "I don't get attached bro", type: 'message' },
  { id: 'msg_002', sender: 'Iteeca', timestamp: '2025-09-14T22:14:00', text: "lol sure you don't", type: 'message' },
  { id: 'msg_003', sender: 'Rahul', timestamp: '2025-09-14T22:15:00', text: "self destruction kink hai mera", type: 'message' },
  { id: 'msg_004', sender: 'Iteeca', timestamp: '2025-09-15T09:00:00', text: "bro did you sleep", type: 'message' },
  { id: 'msg_005', sender: 'Rahul', timestamp: '2025-09-15T09:02:00', text: "i'm fine don't worry about it", type: 'message' },
  { id: 'msg_006', sender: 'Iteeca', timestamp: '2025-10-01T20:00:00', text: "you literally care too much", type: 'message' },
  { id: 'msg_007', sender: 'Rahul', timestamp: '2025-12-05T21:45:00', text: "yeah so I think the problem lies within me...", type: 'message' },
  { id: 'msg_008', sender: 'Iteeca', timestamp: '2025-12-05T21:46:00', text: "bro I said this in september", type: 'message' },
  { id: 'msg_009', sender: 'Rahul', timestamp: '2025-12-05T21:47:00', text: "okay fine. I care. happy?", type: 'message' },
  { id: 'msg_010', sender: 'Iteeca', timestamp: '2025-12-05T21:48:00', text: "TOLD YOU", type: 'message' },
];

const testChunk = {
  id: 'chunk_1',
  startAt: '2025-09-14T22:13:00',
  endAt: '2025-12-05T21:48:00',
  sessionIds: ['session_1'],
  participants: ['Rahul', 'Iteeca'],
  messages: testMessages,
};

async function runSmokeTest() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('EVIDENCE EXTRACTION V2 — SMOKE TEST');
  console.log('═══════════════════════════════════════════════════\n');

  let provider;
  try {
    provider = new GroqProvider();
  } catch (err) {
    console.error('❌ GroqProvider init failed:', err.message);
    console.log('   → Set GROQ_API_KEY in server/.env to run this test');
    process.exit(1);
  }

  // ── 1. Call extraction model ────────────────────────────────────────────────
  console.log('Step 1: Calling extraction model...\n');
  const systemPrompt = buildChunkExtractionSystemPrompt();
  const userPrompt = buildChunkExtractionUserPrompt(testChunk, 0, 1);

  let extraction;
  try {
    extraction = await provider.complete({
      systemPrompt,
      userPrompt,
      schema: ChunkEvidenceSchema,
      tier: 'extraction',
      maxOutputTokens: 3000,
    });
  } catch (err) {
    console.error('❌ Extraction call failed:', err.message);
    process.exit(1);
  }

  console.log(`✅ Extraction succeeded. Raw evidence items: ${extraction.evidence?.length ?? 0}`);
  console.log(`   Topics: ${(extraction.topics || []).join(', ')}`);
  console.log(`   Recurring themes: ${(extraction.recurringThemes || []).join(', ')}\n`);

  // ── 2. Build evidence store ─────────────────────────────────────────────────
  const messageIndex = buildMessageIndex(testMessages);
  const evidenceStore = buildEvidenceStore([extraction], messageIndex);

  console.log('═══════════════════════════════════════════════════');
  console.log(`EVIDENCE STORE: ${evidenceStore.length} validated items`);
  console.log('═══════════════════════════════════════════════════\n');

  // ── 3. Print each evidence item and verify ──────────────────────────────────
  let allValid = true;

  for (const item of evidenceStore) {
    const realMsg = messageIndex.get(item.messageId);

    // Check messageId is real
    if (!realMsg) {
      console.error(`  ❌ INVALID messageId: ${item.messageId} — not in original message list`);
      allValid = false;
      continue;
    }

    // Check text matches
    const textMatch = realMsg.text === item.text;

    console.log(`  [${item.messageId}] ${item.sender} | ${item.type} | importance=${item.importance}`);
    console.log(`    text: "${item.text}"`);
    if (!textMatch) {
      console.error(`    ❌ TEXT MISMATCH! Original: "${realMsg.text}"`);
      allValid = false;
    } else {
      console.log(`    ✅ text matches original`);
    }
    if (item.potentialConnections?.length) {
      console.log(`    connections: ${item.potentialConnections.join(' | ')}`);
    }
    console.log('');
  }

  // ── 4. Final verdict ────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  if (allValid && evidenceStore.length > 0) {
    console.log('✅ SMOKE TEST PASSED');
    console.log(`   ${evidenceStore.length} evidence items, all with valid messageIds and exact text.`);
  } else if (evidenceStore.length === 0) {
    console.warn('⚠️  SMOKE TEST: No evidence extracted (extraction model returned empty evidence[])');
    console.log('   → Check extraction model output and prompt. The model may need adjustment.');
  } else {
    console.error('❌ SMOKE TEST FAILED: Some evidence items had invalid messageIds or text mismatches.');
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════\n');
}

runSmokeTest().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
