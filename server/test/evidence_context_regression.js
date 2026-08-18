import assert from 'assert';
import {
  buildMessageIndex,
  buildEvidenceStore,
  formatEvidenceForPrompt,
  reconstructInteractionContext,
  buildChronologicalMessageIndex,
  validateSelfContainedInteraction,
  deduplicateInteractions,
} from '../lib/evidence.js';

console.log('═══════════════════════════════════════════════════');
console.log('🧪 RUNNING EVIDENCE & CONTEXT RECONSTRUCTION REGRESSION TESTS');
console.log('═══════════════════════════════════════════════════\n');

// ─── TEST DATASET ─────────────────────────────────────────────────────────────
const testMessages = [
  // ── Conversation 1: Playful / Flirting Exchange (Sep 04 14:00) ──
  { id: 'msg_101', sender: 'Rahul', timestamp: '2025-09-04T14:00:00Z', text: 'Tum itni der se reply kyu kr rhi ho', type: 'message' },
  { id: 'msg_102', sender: 'iteeca', timestamp: '2025-09-04T14:01:00Z', text: 'Important kaam tha bro', type: 'message' },
  { id: 'msg_103', sender: 'Rahul', timestamp: '2025-09-04T14:02:00Z', text: 'Acha mere se bhi zyada important koi kaam hai?', type: 'message' },
  { id: 'msg_104', sender: 'iteeca', timestamp: '2025-09-04T14:03:00Z', text: 'Kesi baatein krta hai 💀', type: 'message' },
  { id: 'msg_105', sender: 'Rahul', timestamp: '2025-09-04T14:03:30Z', text: 'Sach bol rha hu', type: 'message' },
  { id: 'msg_106', sender: 'iteeca', timestamp: '2025-09-04T14:04:00Z', text: 'Chup kar pagal', type: 'message' },

  // ── Conversation 2: Missed Call Interaction (Sep 04 18:30) ──
  { id: 'msg_201', sender: 'Rahul', timestamp: '2025-09-04T18:30:00Z', text: 'Free ho?', type: 'message' },
  { id: 'msg_202', sender: 'Rahul', timestamp: '2025-09-04T18:32:00Z', text: 'Call kar raha hu utha', type: 'message' },
  { id: 'msg_203', sender: 'iteeca', timestamp: '2025-09-04T18:40:00Z', text: 'Haan bolo kya hua', type: 'message' },
  { id: 'msg_204', sender: 'Rahul', timestamp: '2025-09-04T18:41:00Z', text: 'haa but tune uthaya ni', type: 'message' },
  { id: 'msg_205', sender: 'iteeca', timestamp: '2025-09-04T18:42:00Z', text: 'Mummy pass me thi isliye 😭', type: 'message' },
  { id: 'msg_206', sender: 'Rahul', timestamp: '2025-09-04T18:43:00Z', text: 'Accha theek hai abhi baat kar sakte?', type: 'message' },

  // ── Conversation 3: Unrelated Ranchi Planning (Sep 05 11:00) ──
  { id: 'msg_301', sender: 'iteeca', timestamp: '2025-09-05T11:00:00Z', text: 'Ranchi kab aana hai tera?', type: 'message' },
  { id: 'msg_302', sender: 'Rahul', timestamp: '2025-09-05T11:02:00Z', text: 'Next week train tickets book kar rha hu', type: 'message' },
  { id: 'msg_303', sender: 'iteeca', timestamp: '2025-09-05T11:03:00Z', text: 'Confirm karke bata dena station aa jaungi', type: 'message' },

  // ── Conversation 4: Private Inside Joke / Callback Candidate (Sep 06 23:00) ──
  { id: 'msg_401', sender: 'Rahul', timestamp: '2025-09-06T23:00:00Z', text: 'Bro did you see that reel about moving to mountains', type: 'message' },
  { id: 'msg_402', sender: 'iteeca', timestamp: '2025-09-06T23:01:00Z', text: 'RIGHT AFTER BREAKING UP 😂😂😂', type: 'message' },
  { id: 'msg_403', sender: 'Rahul', timestamp: '2025-09-06T23:02:00Z', text: 'Classic coping mechanism lmao', type: 'message' },

  // ── Conversation 5: Recurring Topic (Ranchi Trip Update 4 Months Later - Jan 10) ──
  { id: 'msg_501', sender: 'Rahul', timestamp: '2026-01-10T16:00:00Z', text: 'Remember Ranchi plans from September?', type: 'message' },
  { id: 'msg_502', sender: 'iteeca', timestamp: '2026-01-10T16:02:00Z', text: 'Jo kabhi execute nahi hue?', type: 'message' },
  { id: 'msg_503', sender: 'Rahul', timestamp: '2026-01-10T16:03:00Z', text: 'Iss baar pakka I booked Vande Bharat', type: 'message' },
  { id: 'msg_504', sender: 'iteeca', timestamp: '2026-01-10T16:04:00Z', text: 'Dekhte hai 💀', type: 'message' },

  // ── Conversation 6: Vulnerability / Emotional Confession (Feb 14) ──
  { id: 'msg_601', sender: 'Rahul', timestamp: '2026-02-14T02:00:00Z', text: 'Why do you act like you don’t care about anything?', type: 'message' },
  { id: 'msg_602', sender: 'iteeca', timestamp: '2026-02-14T02:02:00Z', text: 'Self destruction kink hai mera', type: 'message' },
  { id: 'msg_603', sender: 'Rahul', timestamp: '2026-02-14T02:03:00Z', text: 'Maza aata hai kya sad hoke?', type: 'message' },
  { id: 'msg_604', sender: 'iteeca', timestamp: '2026-02-14T02:04:00Z', text: 'Haan maza aata hai. Less expectations.', type: 'message' },
  { id: 'msg_605', sender: 'Rahul', timestamp: '2026-02-14T02:05:00Z', text: 'You don’t have to protect your peace from me yaar', type: 'message' },
];

const messageIndex = buildMessageIndex(testMessages);
const { chronological, positionIndex } = buildChronologicalMessageIndex(testMessages);

// ─── TEST A: FLIRTING / PLAYFUL EXCHANGE ──────────────────────────────────────
console.log('▶ TEST A — FLIRTING / PLAYFUL EXCHANGE ("Kesi baatein krta hai")');
const rawExtractionA = [
  {
    evidence: [
      {
        messageId: 'msg_104', // "Kesi baatein krta hai 💀"
        type: 'funny',
        importance: 0.9,
        connection: 'Playful banter over response delay',
      },
    ],
  },
];

const storeA = buildEvidenceStore(rawExtractionA, messageIndex, testMessages);
assert.strictEqual(storeA.length, 1, 'Should create exactly 1 evidence interaction');
const evA = storeA[0];

assert.ok(evA.messages.length >= 4, `Interaction must have >= 4 messages, got ${evA.messages.length}`);
assert.ok(evA.messageIds.includes('msg_103'), 'Must contain preceding setup (msg_103)');
assert.ok(evA.messageIds.includes('msg_104'), 'Must contain target punchline (msg_104)');
assert.ok(evA.messageIds.includes('msg_106'), 'Must contain following resolution (msg_106)');
assert.strictEqual(evA.tone, 'playful_roast', 'Must correctly identify playful_roast tone from exchange');
console.log('  ✅ TEST A PASSED: "Kesi baatein krta hai" is NOT selected alone; full playful exchange preserved.');
console.log(`     Range: ${evA.messageIds[0]} -> ${evA.messageIds[evA.messageIds.length - 1]} (${evA.messages.length} messages)`);

// ─── TEST B: MISSED CALL INTERACTION ──────────────────────────────────────────
console.log('\n▶ TEST B — MISSED CALL CONTEXT ("haa but tune uthaya ni")');
const rawExtractionB = [
  {
    evidence: [
      {
        messageId: 'msg_204', // "haa but tune uthaya ni"
        type: 'conflict',
        importance: 0.85,
        connection: 'Rahul complains about missed call and iteeca explains',
      },
    ],
  },
];

const storeB = buildEvidenceStore(rawExtractionB, messageIndex, testMessages);
assert.strictEqual(storeB.length, 1, 'Should create exactly 1 evidence interaction');
const evB = storeB[0];

assert.ok(evB.messageIds.includes('msg_201') || evB.messageIds.includes('msg_202'), 'Must contain calling trigger (msg_201/202)');
assert.ok(evB.messageIds.includes('msg_204'), 'Must contain target complaint (msg_204)');
assert.ok(evB.messageIds.includes('msg_205'), 'Must contain reason/response (msg_205: Mummy pass me thi)');
console.log('  ✅ TEST B PASSED: "haa but tune uthaya ni" contains preceding calling context and response.');
console.log(`     Range: ${evB.messageIds[0]} -> ${evB.messageIds[evB.messageIds.length - 1]} (${evB.messages.length} messages)`);

// ─── TEST C: UNRELATED RANCHI MESSAGE NO-CROSS-CONTAMINATION ───────────────────
console.log('\n▶ TEST C — UNRELATED RANCHI MESSAGE (NO-CROSS-CONTAMINATION)');
const rawExtractionC = [
  {
    evidence: [
      { messageId: 'msg_104', type: 'funny', importance: 0.9, connection: 'Playful banter' },
      { messageId: 'msg_204', type: 'conflict', importance: 0.85, connection: 'Missed call' },
      { messageId: 'msg_301', type: 'plan', importance: 0.8, connection: 'Ranchi travel plan' },
    ],
  },
];

const storeC = buildEvidenceStore(rawExtractionC, messageIndex, testMessages);
assert.strictEqual(storeC.length, 3, 'Must produce THREE completely separate interactions, never merged');
assert.ok(!storeC[0].messageIds.some(id => storeC[2].messageIds.includes(id)), 'Ranchi messages must not contaminate banter interaction');
console.log('  ✅ TEST C PASSED: Unrelated Ranchi travel plan is completely separated from banter and missed calls.');

// ─── TEST D: PRIVATE JOKE / CALLBACK CANDIDATE ────────────────────────────────
console.log('\n▶ TEST D — PRIVATE JOKE ("RIGHT AFTER BREAKING UP")');
const rawExtractionD = [
  {
    evidence: [
      {
        messageId: 'msg_402', // "RIGHT AFTER BREAKING UP 😂😂😂"
        type: 'inside_joke',
        importance: 0.92,
        connection: 'Mountain reel reaction joke',
      },
    ],
  },
];

const storeD = buildEvidenceStore(rawExtractionD, messageIndex, testMessages);
assert.strictEqual(storeD.length, 1);
const evD = storeD[0];
assert.ok(evD.messageIds.includes('msg_401'), 'Must include the reel setup (msg_401)');
assert.ok(evD.messageIds.includes('msg_402'), 'Must include the punchline (msg_402)');
assert.ok(evD.messageIds.includes('msg_403'), 'Must include the laughter/reaction (msg_403)');
console.log('  ✅ TEST D PASSED: Private joke contains complete setup, punchline, and reaction.');

// ─── TEST E: SAME TOPIC MONTHS APART ──────────────────────────────────────────
console.log('\n▶ TEST E — SAME TOPIC MONTHS APART (Ranchi in Sep vs Jan)');
const rawExtractionE = [
  {
    evidence: [
      { messageId: 'msg_301', type: 'plan', importance: 0.8, connection: 'Initial Ranchi plan in September' },
      { messageId: 'msg_501', type: 'plan', importance: 0.85, connection: 'Ranchi callback 4 months later in January' },
    ],
  },
];

const storeE = buildEvidenceStore(rawExtractionE, messageIndex, testMessages);
assert.strictEqual(storeE.length, 2, 'Must create TWO separate interactions for Sep and Jan');
assert.notStrictEqual(storeE[0].id, storeE[1].id, 'Must have distinct interaction IDs');
assert.ok(new Date(storeE[0].startTimestamp).getMonth() !== new Date(storeE[1].startTimestamp).getMonth(), 'Must preserve distinct month timestamps');
console.log('  ✅ TEST E PASSED: September and January Ranchi plans remain separate local interactions for global pattern discovery.');

// ─── TEST F: DIFFERENT CONVERSATION TYPES ON SAME UNIFIED ARCHITECTURE ────────
console.log('\n▶ TEST F — UNIVERSAL CONVERSATION TYPE HANDLING (Affection, Vulnerability, Plans, Roasting)');
const rawExtractionF = [
  {
    evidence: [
      { messageId: 'msg_104', type: 'funny', importance: 0.9, connection: 'Playful roast' },
      { messageId: 'msg_204', type: 'conflict', importance: 0.85, connection: 'Missed call tension' },
      { messageId: 'msg_301', type: 'plan', importance: 0.8, connection: 'Travel logistics' },
      { messageId: 'msg_602', type: 'vulnerability', importance: 0.95, connection: 'Self destruction kink confession' },
    ],
  },
];

const storeF = buildEvidenceStore(rawExtractionF, messageIndex, testMessages);
assert.strictEqual(storeF.length, 4, 'All 4 diverse conversation types extracted seamlessly on same architecture');

const formattedPrompt = formatEvidenceForPrompt(storeF, 10);
assert.ok(formattedPrompt.includes('Rahul: "Kesi baatein krta hai 💀"') || formattedPrompt.includes('iteeca: "Kesi baatein krta hai 💀"'), 'Prompt must contain dialogue');
assert.ok(formattedPrompt.includes('Self destruction kink hai mera'), 'Prompt must contain confession');
assert.ok(formattedPrompt.includes('Summary:'), 'Prompt must include interaction summary');

console.log('  ✅ TEST F PASSED: Universal architecture handled humor, conflict, logistics, and deep vulnerability with zero prompt changes.');

console.log('\n═══════════════════════════════════════════════════');
console.log('🏆 ALL 6 REGRESSION TESTS PASSED PERFECTLY!');
console.log('═══════════════════════════════════════════════════\n');
console.log('--- SAMPLE FORMATTED DOWNSTREAM EVIDENCE OUTPUT ---');
console.log(formattedPrompt.slice(0, 1200));
console.log('...\n---------------------------------------------------');
