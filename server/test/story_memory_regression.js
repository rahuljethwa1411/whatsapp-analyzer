import assert from 'assert';
import { buildMessageIndex, buildEvidenceStore } from '../lib/evidence.js';
import { buildVerifiedConversationMemory } from '../lib/evidenceIntelligence.js';
import { buildStoryMemory, formatStoryMemoryForPrompt } from '../lib/storyMemory.js';

console.log('═══════════════════════════════════════════════════');
console.log('🧪 RUNNING STORY MEMORY / STORY INPUT LAYER TESTS');
console.log('═══════════════════════════════════════════════════\n');

// ─── SOURCE MESSAGES (LEVEL 1) ────────────────────────────────────────────────
const sourceMessages = [
  // E1: Missed call interaction in Sep
  { id: 'm101', sender: 'Rahul', timestamp: '2025-09-04T18:30:00Z', text: 'Call kar raha hu utha', type: 'message' },
  { id: 'm102', sender: 'iteeca', timestamp: '2025-09-04T18:31:00Z', text: 'Haan bolo kya hua', type: 'message' },
  { id: 'm103', sender: 'Rahul', timestamp: '2025-09-04T18:32:00Z', text: 'haa but tune uthaya ni', type: 'message' },
  { id: 'm104', sender: 'iteeca', timestamp: '2025-09-04T18:33:00Z', text: 'Mummy pass me thi 😭', type: 'message' },

  // E2: Unrelated Ranchi plan in Sep
  { id: 'm201', sender: 'iteeca', timestamp: '2025-09-05T11:00:00Z', text: 'Ranchi kab aana hai tera?', type: 'message' },
  { id: 'm202', sender: 'Rahul', timestamp: '2025-09-05T11:02:00Z', text: 'Next week train tickets book kar rha hu', type: 'message' },
  { id: 'm203', sender: 'iteeca', timestamp: '2025-09-05T11:03:00Z', text: 'Confirm karke bata dena station aa jaungi', type: 'message' },

  // E3: Flirting / banter in Sep
  { id: 'm301', sender: 'Rahul', timestamp: '2025-09-06T14:00:00Z', text: 'Mere se zyada important koi kaam hai kya?', type: 'message' },
  { id: 'm302', sender: 'iteeca', timestamp: '2025-09-06T14:01:00Z', text: 'Kesi baatein krta hai 💀', type: 'message' },
  { id: 'm303', sender: 'iteeca', timestamp: '2025-09-06T14:02:00Z', text: 'Chup kar pagal', type: 'message' },

  // E4: Second missed call interaction in Dec (3 months later)
  { id: 'm401', sender: 'Rahul', timestamp: '2025-12-10T20:00:00Z', text: 'Did you miss my 3 calls again?', type: 'message' },
  { id: 'm402', sender: 'iteeca', timestamp: '2025-12-10T20:02:00Z', text: 'Phone silent pe tha sir sorry', type: 'message' },
  { id: 'm403', sender: 'Rahul', timestamp: '2025-12-10T20:03:00Z', text: 'Classic excuse as always', type: 'message' },

  // E5: Original inside joke in Oct ("The 100-Rupee Pocket")
  { id: 'm501', sender: 'Rahul', timestamp: '2025-10-15T19:00:00Z', text: 'Can you pay for the food delivery?', type: 'message' },
  { id: 'm502', sender: 'iteeca', timestamp: '2025-10-15T19:01:00Z', text: 'Saale 100 rupee bhi nahi hai jeb mein', type: 'message' },
  { id: 'm503', sender: 'Rahul', timestamp: '2025-10-15T19:02:00Z', text: 'Ambani bank bankrupt ho gaya kya', type: 'message' },

  // E6: Genuine Callback in Feb (Explicit reference to E5 joke)
  { id: 'm601', sender: 'Rahul', timestamp: '2026-02-14T21:00:00Z', text: 'Are you buying tickets for the concert?', type: 'message' },
  { id: 'm602', sender: 'iteeca', timestamp: '2026-02-14T21:01:00Z', text: 'Remember when I said 100 rupee bhi nahi hai jeb mein?', type: 'message' },
  { id: 'm603', sender: 'iteeca', timestamp: '2026-02-14T21:02:00Z', text: 'Situation is still the same 😂', type: 'message' },

  // E7: Callback Candidate (Plausible reference without explicit proof)
  { id: 'm701', sender: 'Rahul', timestamp: '2026-03-01T15:00:00Z', text: 'Bro mountains chalo', type: 'message' },
  { id: 'm702', sender: 'iteeca', timestamp: '2026-03-01T15:01:00Z', text: 'Breakup recovery mode activated?', type: 'message' },

  // E8: Contradiction Claim in Sep vs Behavior in Nov
  { id: 'm801', sender: 'Rahul', timestamp: '2025-09-12T23:00:00Z', text: 'I sleep strictly by 11 PM now, fixed routine', type: 'message' },
  { id: 'm802', sender: 'Rahul', timestamp: '2025-11-20T03:15:00Z', text: 'Bro check this reel at 3:15 AM so funny', type: 'message' },

  // E9: Rare High-Value Event (Major Emotional Disclosure / Apology)
  { id: 'm901', sender: 'Rahul', timestamp: '2026-01-20T02:00:00Z', text: 'I am really sorry about how I reacted yesterday. I value you a lot.', type: 'message' },
  { id: 'm902', sender: 'iteeca', timestamp: '2026-01-20T02:03:00Z', text: 'It means a lot that you said that. Thank you.', type: 'message' },

  // E10: Ambiguous Tone Interaction
  { id: 'm1001', sender: 'iteeca', timestamp: '2026-02-01T10:00:00Z', text: 'Fine. Do whatever.', type: 'message' },
  { id: 'm1002', sender: 'Rahul', timestamp: '2026-02-01T10:05:00Z', text: 'Okay.', type: 'message' },
];

const messageIndex = buildMessageIndex(sourceMessages);

// ─── BUILD LEVEL 2 & 3 ────────────────────────────────────────────────────────
const rawExtractions = [
  { evidence: [{ messageId: 'm103', type: 'conflict', importance: 0.85, connection: 'Missed call complaint in Sep' }] },
  { evidence: [{ messageId: 'm201', type: 'plan', importance: 0.8, connection: 'Ranchi travel plan' }] },
  { evidence: [{ messageId: 'm302', type: 'funny', importance: 0.9, connection: 'Playful roast exchange' }] },
  { evidence: [{ messageId: 'm401', type: 'conflict', importance: 0.85, connection: 'Second missed call complaint in Dec' }] },
  { evidence: [{ messageId: 'm502', type: 'funny', importance: 0.92, connection: '100 Rupee Pocket joke origin' }] },
  { evidence: [{ messageId: 'm602', type: 'callback_candidate', importance: 0.95, connection: 'Explicit callback to 100 Rupee joke' }] },
  { evidence: [{ messageId: 'm702', type: 'callback_candidate', importance: 0.75, connection: 'Plausible mountain trip joke' }] },
  { evidence: [{ messageId: 'm801', type: 'contradiction', importance: 0.88, connection: 'Claims 11 PM sleep routine' }] },
  { evidence: [{ messageId: 'm901', type: 'apology', importance: 0.96, connection: 'Heartfelt apology and vulnerability' }] },
  { evidence: [{ messageId: 'm1001', type: 'other', importance: 0.6, connection: 'Ambiguous short exchange' }] },
];

const evidenceStore = buildEvidenceStore(rawExtractions, messageIndex, sourceMessages);
const conversationMemory = buildVerifiedConversationMemory({
  evidenceStore,
  rawInvestigatorResult: {
    patterns: [
      { pattern: 'They repeatedly tease each other about unanswered missed calls', evidence: ['m103', 'm401'] },
    ],
    callbacks: [
      {
        earlier: { messageId: 'm502' },
        later: { messageId: 'm602' },
        connection: 'Explicit callback with "Remember when I said 100 rupee"',
        confidence: 0.95,
      },
      {
        earlier: { messageId: 'm302' },
        later: { messageId: 'm702' },
        connection: 'Plausible mountain trip reference',
        confidence: 0.65,
      },
    ],
    contradictions: [
      {
        claim: 'I sleep strictly by 11 PM now',
        laterBehavior: 'Sending memes at 3:15 AM',
        explanation: 'Rahul claimed early sleep schedule but continued midnight texting.',
        evidence: [{ messageId: 'm801' }],
      },
    ],
    turningPoints: [
      { title: 'The Midnight Shift', description: 'Transition into late night texts', evidence: ['m801'] },
    ],
  },
  metadata: { participants: ['Rahul', 'iteeca'], totalMessages: 15400, durationDays: 180 },
  summaryStats: { peakHour: 'Night', peakDay: 'Weekdays' },
});

// ─── BUILD LEVEL 4 STORY MEMORY ───────────────────────────────────────────────
const storyMemory = buildStoryMemory({
  evidenceStore,
  conversationMemory,
  metadata: { participants: ['Rahul', 'iteeca'], totalMessages: 15400, durationDays: 180 },
  summaryStats: { peakHour: 'Night', peakDay: 'Weekdays' },
});

// ─── TEST A: UNRELATED CONVERSATIONS REMAIN SEPARATE ──────────────────────────
console.log('▶ TEST A: Unrelated conversations remain separate in story memory');
const sepMissedCall = storyMemory.highValueInteractions.find(h => h.messages.some(m => m.id === 'm103'));
const ranchiPlan = storyMemory.highValueInteractions.find(h => h.messages.some(m => m.id === 'm201'));
assert.ok(sepMissedCall && ranchiPlan, 'Both interactions present in highValueInteractions');
assert.notStrictEqual(sepMissedCall.evidenceId, ranchiPlan.evidenceId, 'Must have distinct evidence IDs');
console.log('  ✅ TEST A PASSED: Separate events remain distinct and unmerged in Story Memory.');

// ─── TEST B: SAME TOPIC MONTHS APART PRESERVED SEPARATELY ─────────────────────
console.log('\n▶ TEST B: Same topic months apart preserved separately');
const decMissedCall = storyMemory.highValueInteractions.find(h => h.messages.some(m => m.id === 'm401'));
assert.ok(sepMissedCall && decMissedCall, 'Both Sep and Dec missed call interactions preserved');
assert.ok(sepMissedCall.date.includes('2025-09'), 'Sep date preserved');
assert.ok(decMissedCall.date.includes('2025-12'), 'Dec date preserved');
console.log('  ✅ TEST B PASSED: Longitudinal occurrences preserved across distinct dates.');

// ─── TEST C: GENUINE CALLBACK WITH CONTEXT FROM BOTH SIDES ────────────────────
console.log('\n▶ TEST C: Genuine callback with contexts from BOTH sides');
assert.strictEqual(storyMemory.confirmedCallbacks.length, 1, '1 confirmed callback');
const cb = storyMemory.confirmedCallbacks[0];
assert.ok(cb.original.dialogue.some(d => d.includes('100 rupee')), 'Original contains 100 rupee joke');
assert.ok(cb.later.dialogue.some(d => d.includes('Remember when I said')), 'Later contains explicit callback');
console.log('  ✅ TEST C PASSED: Callback contains full dialogue from both origin and callback scenes.');

// ─── TEST D: CALLBACK CANDIDATE PRESERVED WITHOUT FALSE CERTAINTY ─────────────
console.log('\n▶ TEST D: Callback candidate preserved separately');
assert.strictEqual(storyMemory.callbackCandidates.length, 1, '1 candidate callback');
assert.strictEqual(storyMemory.callbackCandidates[0].type, 'callback_candidate', 'Candidate status preserved');
console.log('  ✅ TEST D PASSED: Candidate preserved without forced certainty.');

// ─── TEST E: RECURRING PATTERN WITH SUPPORTING EVIDENCE AND STRONGEST EXAMPLE ─
console.log('\n▶ TEST E: Recurring pattern with supporting evidence IDs and strongest dialogue');
assert.strictEqual(storyMemory.recurringPatterns.length, 1, '1 verified pattern');
const pat = storyMemory.recurringPatterns[0];
assert.ok(pat.supportingEvidenceIds.length >= 2, 'Pattern cites supporting receipts');
assert.ok(pat.strongestExample.dialogue.length > 0, 'Pattern provides strongest dialogue exchange');
console.log('  ✅ TEST E PASSED: Pattern includes supporting evidence IDs and representative dialogue.');

// ─── TEST F: RARE IMPORTANT MOMENT PRESERVED (HEARTFELT APOLOGY) ──────────────
console.log('\n▶ TEST F: Rare important moment preserved');
const apologyMoment = storyMemory.rareMemorableMoments.find(r => r.type === 'apology');
assert.ok(apologyMoment, 'Apology moment preserved in rare moments');
assert.ok(apologyMoment.dialogue.some(d => d.includes('really sorry')), 'Preserves actual apology dialogue');
console.log('  ✅ TEST F PASSED: Rare apology preserved with exact dialogue.');

// ─── TEST G & H: VOICE PRESERVATION (HINGLISH, SLANG, EMOJIS) ─────────────────
console.log('\n▶ TEST G & H: Voice Preservation (Hinglish, Slang, Emojis, Punctuation)');
const roastInteraction = storyMemory.highValueInteractions.find(h => h.dialogue.some(d => d.includes('Kesi baatein krta hai 💀')));
assert.ok(roastInteraction, 'Preserves Hinglish slang and skull emoji');
assert.ok(roastInteraction.dialogue.some(d => d.includes('Chup kar pagal')), 'Preserves punchline and reaction');
console.log('  ✅ TEST G & H PASSED: Original voice, Hinglish, emojis, and punchlines completely preserved.');

// ─── FORMAT PROMPT CHECK ──────────────────────────────────────────────────────
console.log('\n▶ FORMATTING STORY PROMPT SECTION');
const formattedPrompt = formatStoryMemoryForPrompt(storyMemory);
assert.ok(formattedPrompt.includes('CONVERSATION OVERVIEW:'), 'Includes conversation overview');
assert.ok(formattedPrompt.includes('HIGH-VALUE CONVERSATIONAL INTERACTIONS'), 'Includes high value interactions');
assert.ok(formattedPrompt.includes('CONFIRMED CALLBACKS'), 'Includes confirmed callbacks');
assert.ok(formattedPrompt.includes('Kesi baatein krta hai 💀'), 'Includes raw dialogue in prompt');
assert.ok(formattedPrompt.includes('Remember when I said 100 rupee'), 'Includes callback dialogue in prompt');

console.log('═══════════════════════════════════════════════════');
console.log('🏆 ALL STORY MEMORY REGRESSION TESTS PASSED!');
console.log('═══════════════════════════════════════════════════\n');

// ─── OUTPUTS REQUIRED BY STOP CONDITION ───────────────────────────────────────
console.log('===================================================');
console.log('1. TELEMETRY:');
console.log(JSON.stringify(storyMemory._telemetry, null, 2));
console.log('\n2. SELECTED EVIDENCE IDs:');
console.log(storyMemory.highValueInteractions.map(h => h.evidenceId));
console.log('\n3. ONE CONFIRMED CALLBACK WITH BOTH CONTEXTS:');
console.log(JSON.stringify(storyMemory.confirmedCallbacks[0], null, 2));
console.log('\n4. ONE RECURRING PATTERN WITH SUPPORTING EVIDENCE:');
console.log(JSON.stringify(storyMemory.recurringPatterns[0], null, 2));
console.log('\n5. ONE HIGH-VALUE INTERACTION WITH ACTUAL DIALOGUE:');
console.log(JSON.stringify(storyMemory.highValueInteractions[0], null, 2));
console.log('\n6. STORY MEMORY JSON SAMPLE (COMPACT NARRATIVE INGREDIENTS):');
console.log(JSON.stringify({
  conversationOverview: storyMemory.conversationOverview,
  timeline: storyMemory.timeline.slice(0, 3),
  highValueInteractionsCount: storyMemory.highValueInteractions.length,
  recurringPatternsCount: storyMemory.recurringPatterns.length,
  confirmedCallbacksCount: storyMemory.confirmedCallbacks.length,
  rareMomentsCount: storyMemory.rareMemorableMoments.length,
}, null, 2));
console.log('===================================================');
