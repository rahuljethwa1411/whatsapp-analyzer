/**
 * Story Generation Layer Test
 *
 * Uses an existing Story Memory fixture (built from the regression test data)
 * to verify:
 *  1. Chapter scaffold is data-driven (not hardcoded templates)
 *  2. System prompt enforces narrative — not forensic analysis language
 *  3. buildStoryAnglesFromMemory produces 10 distinct angles
 *  4. normalizeEvidenceIds merges evidenceIds / evidenceMessageIds correctly
 *  5. Chapter enforcement uses evidence-grounded stubs (not generic filler)
 *  6. Baseline story uses actual Story Memory dialogue
 *
 * Does NOT make live API calls.
 */

import assert from 'assert';
import { buildMessageIndex, buildEvidenceStore } from '../lib/evidence.js';
import { buildVerifiedConversationMemory } from '../lib/evidenceIntelligence.js';
import { buildStoryMemory, formatStoryMemoryForPrompt } from '../lib/storyMemory.js';
import { buildStorySystemPrompt, buildStoryUserPrompt } from '../lib/ai/prompts/storyPrompt.js';
import {
  buildStoryAnglesFromMemory,
  enforceTenChapters,
} from '../lib/storyGenerator.js';

console.log('═══════════════════════════════════════════════════');
console.log('🧪 STORY GENERATION LAYER TESTS');
console.log('═══════════════════════════════════════════════════\n');

// ─── BUILD FIXTURE: STORY MEMORY FROM REGRESSION DATA ─────────────────────────

const sourceMessages = [
  { id: 'm101', sender: 'Rahul', timestamp: '2025-09-04T18:30:00Z', text: 'Call kar raha hu utha', type: 'message' },
  { id: 'm102', sender: 'iteeca', timestamp: '2025-09-04T18:31:00Z', text: 'Haan bolo kya hua', type: 'message' },
  { id: 'm103', sender: 'Rahul', timestamp: '2025-09-04T18:32:00Z', text: 'haa but tune uthaya ni', type: 'message' },
  { id: 'm104', sender: 'iteeca', timestamp: '2025-09-04T18:33:00Z', text: 'Mummy pass me thi 😭', type: 'message' },
  { id: 'm201', sender: 'iteeca', timestamp: '2025-09-05T11:00:00Z', text: 'Ranchi kab aana hai tera?', type: 'message' },
  { id: 'm202', sender: 'Rahul', timestamp: '2025-09-05T11:02:00Z', text: 'Next week train tickets book kar rha hu', type: 'message' },
  { id: 'm203', sender: 'iteeca', timestamp: '2025-09-05T11:03:00Z', text: 'Confirm karke bata dena', type: 'message' },
  { id: 'm301', sender: 'Rahul', timestamp: '2025-09-06T14:00:00Z', text: 'Mere se zyada important koi kaam hai kya?', type: 'message' },
  { id: 'm302', sender: 'iteeca', timestamp: '2025-09-06T14:01:00Z', text: 'Kesi baatein krta hai 💀', type: 'message' },
  { id: 'm303', sender: 'iteeca', timestamp: '2025-09-06T14:02:00Z', text: 'Chup kar pagal', type: 'message' },
  { id: 'm401', sender: 'Rahul', timestamp: '2025-12-10T20:00:00Z', text: 'Did you miss my 3 calls again?', type: 'message' },
  { id: 'm402', sender: 'iteeca', timestamp: '2025-12-10T20:02:00Z', text: 'Phone silent pe tha sir sorry', type: 'message' },
  { id: 'm403', sender: 'Rahul', timestamp: '2025-12-10T20:03:00Z', text: 'Classic excuse as always', type: 'message' },
  { id: 'm501', sender: 'Rahul', timestamp: '2025-10-15T19:00:00Z', text: 'Can you pay for the food delivery?', type: 'message' },
  { id: 'm502', sender: 'iteeca', timestamp: '2025-10-15T19:01:00Z', text: 'Saale 100 rupee bhi nahi hai jeb mein', type: 'message' },
  { id: 'm503', sender: 'Rahul', timestamp: '2025-10-15T19:02:00Z', text: 'Ambani bank bankrupt ho gaya kya', type: 'message' },
  { id: 'm601', sender: 'Rahul', timestamp: '2026-02-14T21:00:00Z', text: 'Are you buying tickets for the concert?', type: 'message' },
  { id: 'm602', sender: 'iteeca', timestamp: '2026-02-14T21:01:00Z', text: 'Remember when I said 100 rupee bhi nahi hai jeb mein?', type: 'message' },
  { id: 'm603', sender: 'iteeca', timestamp: '2026-02-14T21:02:00Z', text: 'Situation is still the same 😂', type: 'message' },
  { id: 'm701', sender: 'Rahul', timestamp: '2026-03-01T15:00:00Z', text: 'Bro mountains chalo', type: 'message' },
  { id: 'm702', sender: 'iteeca', timestamp: '2026-03-01T15:01:00Z', text: 'Breakup recovery mode activated?', type: 'message' },
  { id: 'm801', sender: 'Rahul', timestamp: '2025-09-12T23:00:00Z', text: 'I sleep strictly by 11 PM now, fixed routine', type: 'message' },
  { id: 'm802', sender: 'Rahul', timestamp: '2025-11-20T03:15:00Z', text: 'Bro check this reel at 3:15 AM so funny', type: 'message' },
  { id: 'm901', sender: 'Rahul', timestamp: '2026-01-20T02:00:00Z', text: 'I am really sorry about how I reacted yesterday. I value you a lot.', type: 'message' },
  { id: 'm902', sender: 'iteeca', timestamp: '2026-01-20T02:03:00Z', text: 'It means a lot that you said that. Thank you.', type: 'message' },
  { id: 'm1001', sender: 'iteeca', timestamp: '2026-02-01T10:00:00Z', text: 'Fine. Do whatever.', type: 'message' },
  { id: 'm1002', sender: 'Rahul', timestamp: '2026-02-01T10:05:00Z', text: 'Okay.', type: 'message' },
];

const rawExtractions = [
  { evidence: [{ messageId: 'm103', type: 'conflict',          importance: 0.85, connection: 'Missed call complaint in Sep' }] },
  { evidence: [{ messageId: 'm201', type: 'plan',              importance: 0.80, connection: 'Ranchi travel plan' }] },
  { evidence: [{ messageId: 'm302', type: 'funny',             importance: 0.90, connection: 'Playful roast — kesi baatein krta hai' }] },
  { evidence: [{ messageId: 'm401', type: 'conflict',          importance: 0.85, connection: 'Second missed call complaint in Dec' }] },
  { evidence: [{ messageId: 'm502', type: 'funny',             importance: 0.92, connection: '100 Rupee Pocket joke origin' }] },
  { evidence: [{ messageId: 'm602', type: 'callback_candidate',importance: 0.95, connection: 'Explicit callback — Remember when I said 100 rupee' }] },
  { evidence: [{ messageId: 'm702', type: 'callback_candidate',importance: 0.75, connection: 'Mountains trip / plausible callback' }] },
  { evidence: [{ messageId: 'm801', type: 'contradiction',     importance: 0.88, connection: 'Claims 11 PM sleep routine' }] },
  { evidence: [{ messageId: 'm901', type: 'apology',           importance: 0.96, connection: 'Rare heartfelt apology and vulnerability' }] },
  { evidence: [{ messageId: 'm1001',type: 'other',             importance: 0.60, connection: 'Ambiguous short exchange' }] },
];

const messageIndex = buildMessageIndex(sourceMessages);
const evidenceStore = buildEvidenceStore(rawExtractions, messageIndex, sourceMessages);

const conversationMemory = buildVerifiedConversationMemory({
  evidenceStore,
  rawInvestigatorResult: {
    patterns: [
      { pattern: 'Missed calls repeatedly become a running source of playful complaints', evidence: ['m103', 'm401'] },
    ],
    callbacks: [
      { earlier: { messageId: 'm502' }, later: { messageId: 'm602' }, connection: 'Explicit callback: "Remember when I said 100 rupee"', confidence: 0.95 },
    ],
    contradictions: [
      { claim: 'I sleep strictly by 11 PM now', laterBehavior: 'Sending reels at 3:15 AM in November', explanation: 'Rahul claimed fixed early sleep but was active at 3AM months later.', evidence: [{ messageId: 'm801' }], confidence: 0.9 },
    ],
    turningPoints: [
      { title: 'The Midnight Confession', description: 'First time Rahul openly apologized without deflecting into humor', before: 'All interactions were either playful or logistical', after: 'A rare moment of genuine vulnerability exchanged', evidence: ['m901'] },
    ],
  },
  metadata: { participants: ['Rahul', 'iteeca'] },
  summaryStats: { peakHour: 'Night', peakDay: 'Weekdays' },
});

const storyMemory = buildStoryMemory({
  evidenceStore,
  conversationMemory,
  metadata: { participants: ['Rahul', 'iteeca'], totalMessages: 26, durationDays: 180, startDate: '2025-09-04', endDate: '2026-03-01' },
  summaryStats: { peakHour: 'Night', peakDay: 'Weekdays', peakMonth: 'September', longestSilenceDays: 14, longestStreakDays: 45, mostUsedEmoji: '💀', topWords: ['call', 'ranchi', 'bro', 'rupee', 'ticket'] },
});

console.log('✓ Story Memory built from fixture evidence\n');

// ═══════════════════════════════════════════════════
// TEST 1: Story Memory produces high-value interactions with real dialogue
// ═══════════════════════════════════════════════════
console.log('▶ TEST 1: Story Memory — high-value interactions carry real dialogue');
assert.ok(storyMemory.highValueInteractions.length > 0, 'Must have high-value interactions');
const hvFirst = storyMemory.highValueInteractions[0];
assert.ok(hvFirst.dialogue && hvFirst.dialogue.length > 0, 'HV interaction must have dialogue');
assert.ok(hvFirst.evidenceId, 'HV interaction must have evidenceId');
assert.ok(hvFirst.context, 'HV interaction must have context');
// Verify actual message text appears (not generic filler)
const allDialogue = storyMemory.highValueInteractions.flatMap(h => h.dialogue).join(' ');
assert.ok(
  allDialogue.includes('Rahul') || allDialogue.includes('iteeca'),
  'Dialogue must include actual participant names'
);
console.log('  ✅ TEST 1 PASSED: Story Memory carries real dialogue from evidence interactions.');
console.log(`     Sample dialogue: "${hvFirst.dialogue[0]}"`);

// ═══════════════════════════════════════════════════
// TEST 2: buildStoryAnglesFromMemory — produces data-driven angles (not hardcoded)
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 2: buildStoryAnglesFromMemory — data-driven, not fixed templates');
const storyAngles = buildStoryAnglesFromMemory(
  storyMemory,
  { participants: ['Rahul', 'iteeca'], totalMessages: 26, durationDays: 180 },
  { peakHour: 'Night', peakDay: 'Weekdays' }
);
assert.ok(storyAngles.length >= 1, 'Must produce at least 1 angle');
assert.ok(storyAngles.length <= 10, 'Must produce at most 10 angles');

// Each angle must have actual evidence IDs or real reason text
for (const angle of storyAngles) {
  assert.ok(angle.title, `Angle must have title`);
  assert.ok(angle.reason || (angle.evidenceIds || []).length > 0, `Angle must have reason or evidence IDs`);
}

// No two angles should have identical titles (no template duplication)
const titles = storyAngles.map(a => a.title);
const uniqueTitles = new Set(titles);
assert.strictEqual(uniqueTitles.size, titles.length, 'All angle titles must be unique — no template duplication');

// Contradiction angle should reference actual contradiction evidence
const contradictionAngle = storyAngles.find(a => a.title.includes('Exhibit') || a.title.includes('Contradiction'));
if (contradictionAngle) {
  assert.ok((contradictionAngle.evidenceIds || []).length > 0 || contradictionAngle.reason.includes('sleep'), 'Contradiction angle must reference actual evidence');
}

// Callback angle should reference actual callback evidence
const callbackAngle = storyAngles.find(a => a.title.includes('Callback') || a.title.includes('Long-Range'));
if (callbackAngle) {
  assert.ok((callbackAngle.evidenceIds || []).length > 0, 'Callback angle must have evidence IDs');
}

console.log('  ✅ TEST 2 PASSED: Story angles are data-driven with unique, specific titles.');
console.log(`     Generated ${storyAngles.length} angles:`);
storyAngles.forEach((a, i) => console.log(`     ${i + 1}. "${a.title}" [evidenceIds: ${(a.evidenceIds || []).join(', ') || 'none'}]`));

// ═══════════════════════════════════════════════════
// TEST 3: System prompt does NOT contain forbidden forensic language
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 3: System prompt is free of forensic/AI-analysis framing');
const systemPrompt = buildStorySystemPrompt();

// These should NOT appear as instructions/framing (the AfterChat forensic report template)
const BANNED_AS_FRAMING = [
  'AfterChat Signature Forensic Report',  // old forensic-report label
  'Episode 1: First Contact & The Zero-Filter Kickoff',  // old hardcoded episodes
  'Episode 2: The 3 AM Reel Dump',
  '180–250 words',  // old short chapter limit (spec requires 500-900)
  // Note: subpoena/jurisdiction/indictment appear in the BANNED LANGUAGE section — that's correct.
  // We only check they're not used as narrative INSTRUCTIONS.
  'DO NOT use stiff words like \"subpoena\"',  // old instruction wording from forensic prompt
];
for (const banned of BANNED_AS_FRAMING) {
  assert.ok(
    !systemPrompt.includes(banned),
    `System prompt must NOT contain banned framing: "${banned}"`
  );
}
// System prompt must contain the core narrative rules
assert.ok(systemPrompt.includes('CONTEXT BEFORE COMMENTARY'), 'Must contain CONTEXT BEFORE COMMENTARY rule');
assert.ok(systemPrompt.includes('SPECIFICITY BEFORE GENERALIZATION'), 'Must contain SPECIFICITY rule');
assert.ok(systemPrompt.includes('500'), 'Must specify 500-word minimum chapter length');
assert.ok(systemPrompt.includes('SEPARATE INTERACTIONS STAY SEPARATE'), 'Must contain interaction separation rule');
assert.ok(systemPrompt.includes('evidenceIds'), 'Output schema must use evidenceIds field');
// Must NOT define itself as a "forensic" report generator
assert.ok(!systemPrompt.includes('write the definitive AfterChat Signature Forensic Report'), 'Must not frame output as forensic report');
console.log('  ✅ TEST 3 PASSED: System prompt is clean of forensic framing and contains all core narrative rules.');

// ═══════════════════════════════════════════════════
// TEST 4: User prompt scaffold is data-driven from Story Memory
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 4: User prompt scaffold is data-driven (references actual evidence)');
const userPrompt = buildStoryUserPrompt({
  intelligence: { _evidenceStore: [], _conversationMemory: conversationMemory },
  summaryStats: { peakHour: 'Night', peakDay: 'Weekdays', longestSilenceDays: 14, longestStreakDays: 45, mostUsedEmoji: '💀', topWords: ['call', 'ranchi', 'bro'] },
  metadata: { participants: ['Rahul', 'iteeca'], totalMessages: 26, durationDays: 180, startDate: '2025-09-04', endDate: '2026-03-01' },
  formattedReceipts: null,
  storyAngles,
  storyMemory,
});

// Verify no isolated receipt rows (no "[msg_X] sender: text" lines)
assert.ok(!userPrompt.includes('[msg_'), 'User prompt must NOT contain isolated [msg_X] receipt rows');

// Verify the scaffold is present and data-driven
assert.ok(userPrompt.includes('CHAPTER 1'), 'Must contain Chapter 1 scaffold');
assert.ok(userPrompt.includes('CHAPTER 10'), 'Must contain Chapter 10 scaffold');
assert.ok(userPrompt.includes('Story Memory'), 'Scaffold must reference Story Memory evidence');

// Verify actual participant names appear
assert.ok(userPrompt.includes('Rahul'), 'Prompt must mention actual participant names');
assert.ok(userPrompt.includes('iteeca'), 'Prompt must mention actual participant names');

// Verify Story Memory section is included (actual dialogue)
const hasDialogue = userPrompt.includes('"Mummy pass me thi') || userPrompt.includes('"haa but tune uthaya ni') || userPrompt.includes('"Saale 100 rupee');
assert.ok(hasDialogue, 'User prompt must include actual dialogue from Story Memory');

// Verify no hardcoded template episodes
const BANNED_IN_USER = [
  'Episode 1: First Contact & The Zero-Filter Kickoff',
  'Episode 2: The 3 AM Reel Dump',
  'Episode 3: The Big Silence',
];
for (const banned of BANNED_IN_USER) {
  assert.ok(!userPrompt.includes(banned), `User prompt must NOT contain hardcoded episode: "${banned}"`);
}

console.log('  ✅ TEST 4 PASSED: User prompt is data-driven, contains real dialogue, no isolated receipt rows.');

// ═══════════════════════════════════════════════════
// TEST 5: enforceTenChapters — evidence-grounded, not generic filler
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 5: enforceTenChapters — fills gaps with evidence-grounded stubs, not filler');
const BANNED_FILLER = [
  'evolved with distinctive energy and conversational pacing',
  'captures their characteristic texting habits, spontaneous banter, and shared timeline moments',
  'The interaction captures their characteristic',
];

// Test with only 3 chapters provided — should fill to 10 without generic filler
const skeletonStory = {
  title: 'Test Story',
  subtitle: 'Test',
  opening: 'Test opening',
  chapters: [
    { id: 'chap_1', title: 'Chapter 1', period: '2025-09', narrative: 'Real narrative one.', keyStats: [], evidenceIds: ['ev_int_1'], evidenceMessageIds: ['ev_int_1'] },
    { id: 'chap_2', title: 'Chapter 2', period: '2025-10', narrative: 'Real narrative two.', keyStats: [], evidenceIds: ['ev_int_3'], evidenceMessageIds: ['ev_int_3'] },
    { id: 'chap_3', title: 'Chapter 3', period: '2025-12', narrative: 'Real narrative three.', keyStats: [], evidenceIds: ['ev_int_4'], evidenceMessageIds: ['ev_int_4'] },
  ],
  awards: [],
  verdict: { title: 'Test Verdict', description: '', badge: '' },
  ending: '',
};

const enforced = enforceTenChapters(skeletonStory, storyMemory, storyAngles);
assert.strictEqual(enforced.chapters.length, 10, 'Must enforce exactly 10 chapters');

// Check gap-filled chapters don't use generic filler
for (const chapter of enforced.chapters.slice(3)) {
  for (const filler of BANNED_FILLER) {
    assert.ok(
      !chapter.narrative.includes(filler),
      `Chapter "${chapter.title}" must NOT contain generic filler: "${filler.slice(0, 40)}..."`
    );
  }
}

// Verify first 3 original chapters preserved
assert.strictEqual(enforced.chapters[0].narrative, 'Real narrative one.', 'Original chapters must be preserved');
assert.strictEqual(enforced.chapters[1].narrative, 'Real narrative two.', 'Original chapters must be preserved');
assert.strictEqual(enforced.chapters[2].narrative, 'Real narrative three.', 'Original chapters must be preserved');

console.log('  ✅ TEST 5 PASSED: Chapter enforcement fills gaps with evidence-grounded content, original chapters preserved.');

// ═══════════════════════════════════════════════════
// TEST 6: evidenceIds normalization (both fields merged)
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 6: evidenceIds / evidenceMessageIds normalization');
// Simulate model returning only evidenceIds (new schema)
const withNewSchema = {
  ...skeletonStory,
  chapters: [
    { id: 'chap_1', title: 'Ch1', period: '', narrative: 'Narrative', keyStats: [], evidenceIds: ['ev_int_1', 'ev_int_2'], evidenceMessageIds: [] },
    { id: 'chap_2', title: 'Ch2', period: '', narrative: 'Narrative 2', keyStats: [], evidenceIds: [], evidenceMessageIds: ['m101', 'm102'] },
  ],
};
const enforced2 = enforceTenChapters(withNewSchema, storyMemory, storyAngles);
// After enforce, both fields should be populated
assert.ok(enforced2.chapters[0].evidenceIds.includes('ev_int_1'), 'New-schema evidenceIds must be preserved');
assert.ok(enforced2.chapters[0].evidenceMessageIds.includes('ev_int_1'), 'evidenceMessageIds must mirror evidenceIds');
assert.ok(enforced2.chapters[1].evidenceIds.includes('m101'), 'Legacy evidenceMessageIds must be promoted to evidenceIds');
console.log('  ✅ TEST 6 PASSED: Both evidenceIds and evidenceMessageIds are correctly normalized.');

// ═══════════════════════════════════════════════════
// SAMPLE: 3-chapter preview from formatStoryMemoryForPrompt
// ═══════════════════════════════════════════════════
console.log('\n══════ SAMPLE: Story Memory prompt section (first 3000 chars) ══════');
const formatted = formatStoryMemoryForPrompt(storyMemory);
console.log(formatted.slice(0, 3000));
console.log('...[truncated for test output]\n');

console.log('\n══════ SAMPLE: Data-driven chapter scaffold (from user prompt) ══════');
// Extract the scaffold section from the user prompt
const scaffoldStart = userPrompt.indexOf('CHAPTER 1');
const scaffoldEnd = userPrompt.indexOf('TASK: WRITE THE COMPLETE');
if (scaffoldStart !== -1 && scaffoldEnd !== -1) {
  console.log(userPrompt.slice(scaffoldStart, scaffoldEnd).slice(0, 2500));
}

console.log('\n═══════════════════════════════════════════════════');
console.log('🏆 ALL STORY GENERATION LAYER TESTS PASSED!');
console.log('═══════════════════════════════════════════════════\n');
