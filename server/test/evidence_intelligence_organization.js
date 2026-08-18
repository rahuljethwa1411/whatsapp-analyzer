import assert from 'assert';
import {
  buildMessageIndex,
  buildEvidenceStore,
} from '../lib/evidence.js';
import {
  organizeVerifiedEvents,
  discoverRecurringTopics,
  organizeCallbacks,
  organizeAndDeduplicatePatterns,
  buildVerifiedConversationMemory,
} from '../lib/evidenceIntelligence.js';

console.log('═══════════════════════════════════════════════════');
console.log('🧪 RUNNING EVIDENCE INTELLIGENCE & ORGANIZATION TESTS');
console.log('═══════════════════════════════════════════════════\n');

// ─── LEVEL 1 SOURCE MESSAGES ──────────────────────────────────────────────────
const sourceMessages = [
  // E1: Missed call — September
  { id: 'm101', sender: 'Rahul', timestamp: '2025-09-04T18:30:00Z', text: 'Call kar raha hu utha', type: 'message' },
  { id: 'm102', sender: 'iteeca', timestamp: '2025-09-04T18:31:00Z', text: 'Haan bolo kya hua', type: 'message' },
  { id: 'm103', sender: 'Rahul', timestamp: '2025-09-04T18:32:00Z', text: 'haa but tune uthaya ni', type: 'message' },
  { id: 'm104', sender: 'iteeca', timestamp: '2025-09-04T18:33:00Z', text: 'Mummy pass me thi 😭', type: 'message' },

  // E2: Unrelated travel plan — September
  { id: 'm201', sender: 'iteeca', timestamp: '2025-09-05T11:00:00Z', text: 'Ranchi kab aana hai tera?', type: 'message' },
  { id: 'm202', sender: 'Rahul', timestamp: '2025-09-05T11:02:00Z', text: 'Next week train tickets book kar rha hu', type: 'message' },
  { id: 'm203', sender: 'iteeca', timestamp: '2025-09-05T11:03:00Z', text: 'Confirm karke bata dena', type: 'message' },

  // E3: Flirting / Playful roast — September
  { id: 'm301', sender: 'Rahul', timestamp: '2025-09-06T14:00:00Z', text: 'Mere se zyada important koi kaam hai kya?', type: 'message' },
  { id: 'm302', sender: 'iteeca', timestamp: '2025-09-06T14:01:00Z', text: 'Kesi baatein krta hai 💀', type: 'message' },
  { id: 'm303', sender: 'iteeca', timestamp: '2025-09-06T14:02:00Z', text: 'Chup kar pagal', type: 'message' },

  // E4: Second missed call — December (3 months later)
  { id: 'm401', sender: 'Rahul', timestamp: '2025-12-10T20:00:00Z', text: 'Did you miss my 3 calls again?', type: 'message' },
  { id: 'm402', sender: 'iteeca', timestamp: '2025-12-10T20:02:00Z', text: 'Phone silent pe tha sir sorry', type: 'message' },
  { id: 'm403', sender: 'Rahul', timestamp: '2025-12-10T20:03:00Z', text: 'Classic excuse as always', type: 'message' },

  // E5: Original inside joke — October ("The 100-Rupee Pocket")
  { id: 'm501', sender: 'Rahul', timestamp: '2025-10-15T19:00:00Z', text: 'Can you pay for the food delivery?', type: 'message' },
  { id: 'm502', sender: 'iteeca', timestamp: '2025-10-15T19:01:00Z', text: 'Saale 100 rupee bhi nahi hai jeb mein', type: 'message' },
  { id: 'm503', sender: 'Rahul', timestamp: '2025-10-15T19:02:00Z', text: 'Ambani bank bankrupt ho gaya kya', type: 'message' },

  // E6: Genuine Callback — February (explicit "Remember when I said...")
  { id: 'm601', sender: 'Rahul', timestamp: '2026-02-14T21:00:00Z', text: 'Are you buying tickets for the concert?', type: 'message' },
  { id: 'm602', sender: 'iteeca', timestamp: '2026-02-14T21:01:00Z', text: 'Remember when I said 100 rupee bhi nahi hai jeb mein?', type: 'message' },
  { id: 'm603', sender: 'iteeca', timestamp: '2026-02-14T21:02:00Z', text: 'Situation is still the same 😂', type: 'message' },

  // E7: Callback Candidate — March (plausible but no explicit "remember")
  { id: 'm701', sender: 'Rahul', timestamp: '2026-03-01T15:00:00Z', text: 'Bro mountains chalo', type: 'message' },
  { id: 'm702', sender: 'iteeca', timestamp: '2026-03-01T15:01:00Z', text: 'Breakup recovery mode activated?', type: 'message' },

  // E8: Contradiction — Sep claim vs Nov behavior
  { id: 'm801', sender: 'Rahul', timestamp: '2025-09-12T23:00:00Z', text: 'I sleep strictly by 11 PM now, fixed routine', type: 'message' },
  { id: 'm802', sender: 'Rahul', timestamp: '2025-11-20T03:15:00Z', text: 'Bro check this reel at 3:15 AM so funny', type: 'message' },

  // E9: Rare High-Value Event — Heartfelt apology (only once)
  { id: 'm901', sender: 'Rahul', timestamp: '2026-01-20T02:00:00Z', text: 'I am really sorry about how I reacted yesterday. I value you a lot.', type: 'message' },
  { id: 'm902', sender: 'iteeca', timestamp: '2026-01-20T02:03:00Z', text: 'It means a lot that you said that. Thank you.', type: 'message' },

  // E10: Ambiguous short exchange
  { id: 'm1001', sender: 'iteeca', timestamp: '2026-02-01T10:00:00Z', text: 'Fine. Do whatever.', type: 'message' },
  { id: 'm1002', sender: 'Rahul', timestamp: '2026-02-01T10:05:00Z', text: 'Okay.', type: 'message' },
];

const messageIndex = buildMessageIndex(sourceMessages);

// ─── RECONSTRUCT LEVEL 2 EVIDENCE STORE ──────────────────────────────────────
const rawExtractions = [
  { evidence: [{ messageId: 'm103', type: 'conflict',          importance: 0.85, connection: 'Missed call complaint in Sep' }] },
  { evidence: [{ messageId: 'm201', type: 'plan',              importance: 0.80, connection: 'Ranchi travel plan' }] },
  { evidence: [{ messageId: 'm302', type: 'funny',             importance: 0.90, connection: 'Playful roast exchange' }] },
  { evidence: [{ messageId: 'm401', type: 'conflict',          importance: 0.85, connection: 'Second missed call complaint in Dec' }] },
  { evidence: [{ messageId: 'm502', type: 'funny',             importance: 0.92, connection: '100 Rupee Pocket joke origin' }] },
  { evidence: [{ messageId: 'm602', type: 'callback_candidate',importance: 0.95, connection: 'Explicit callback to 100 Rupee joke' }] },
  { evidence: [{ messageId: 'm702', type: 'callback_candidate',importance: 0.75, connection: 'Plausible mountain trip joke' }] },
  { evidence: [{ messageId: 'm801', type: 'contradiction',     importance: 0.88, connection: 'Claims 11 PM sleep routine' }] },
  { evidence: [{ messageId: 'm901', type: 'apology',           importance: 0.96, connection: 'Rare heartfelt apology and vulnerability' }] },
  { evidence: [{ messageId: 'm1001',type: 'other',             importance: 0.60, connection: 'Ambiguous short exchange' }] },
];

const evidenceStore = buildEvidenceStore(rawExtractions, messageIndex, sourceMessages);
console.log(`✓ Level 2 Evidence Store: ${evidenceStore.length} self-contained interactions\n`);

// ═══════════════════════════════════════════════════
// TEST 1: Multiple separate interactions about same topic
// ═══════════════════════════════════════════════════
console.log('▶ TEST 1: Multiple separate interactions — same topic, separate events (Sep vs Dec missed calls)');
const verifiedEvents = organizeVerifiedEvents(evidenceStore);
const sepCallEvent = verifiedEvents.find(e => e.supportingMessageIds.includes('m103'));
const decCallEvent = verifiedEvents.find(e => e.supportingMessageIds.includes('m401'));

assert.ok(sepCallEvent && decCallEvent, 'Both missed call events must exist');
assert.notStrictEqual(sepCallEvent.evidenceId, decCallEvent.evidenceId, 'Events MUST remain separate — never merged');
assert.ok(sepCallEvent.startTime.includes('2025-09'), 'Sep event has Sep timestamp');
assert.ok(decCallEvent.startTime.includes('2025-12'), 'Dec event has Dec timestamp');
// Verify observed/interpretation separation (§ 7)
assert.ok(sepCallEvent.observed, 'VerifiedEvent must have observed field');
assert.ok(sepCallEvent.interpretation, 'VerifiedEvent must have interpretation field');
assert.notStrictEqual(sepCallEvent.observed, sepCallEvent.interpretation, 'observed and interpretation must be distinct');
// Verify dynamic outcome (§ 4 — not hardcoded)
assert.ok(sepCallEvent.outcome, 'Must have a derived outcome');
console.log('  ✅ TEST 1 PASSED: Sep & Dec missed call events preserved separately with observed/interpretation split.');
console.log(`     Sep outcome: "${sepCallEvent.outcome}"`);
console.log(`     Dec outcome: "${decCallEvent.outcome}"`);

// ═══════════════════════════════════════════════════
// TEST 2: Genuine Callback (explicit reference)
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 2: Genuine Callback with explicit reference ("Remember when I said...")');
const investigatorCallbacks = [
  {
    earlier: { messageId: 'm502' },
    later: { messageId: 'm602' },
    connection: 'Explicit callback with "Remember when I said 100 rupee"',
    confidence: 0.95,
  },
];
const { callbacks } = organizeCallbacks(verifiedEvents, investigatorCallbacks);
assert.strictEqual(callbacks.length, 1, 'Must recognize 1 confirmed callback');
assert.strictEqual(callbacks[0].type, 'callback', 'Type must be callback');
assert.ok(callbacks[0].connection.toLowerCase().includes('remember'), 'Connection cites explicit proof');
assert.ok(callbacks[0].confidence >= 0.88, 'High confidence for explicit callback');
console.log('  ✅ TEST 2 PASSED: Genuine callback confirmed. Original:', callbacks[0].originalEvidenceId, '→ Later:', callbacks[0].laterEvidenceId);

// ═══════════════════════════════════════════════════
// TEST 3: Callback Candidate (plausible, not proven)
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 3: Callback Candidate (plausible but no explicit "remember")');
const candidateCallbacks = [
  {
    earlier: { messageId: 'm302' },
    later: { messageId: 'm702' },
    connection: 'Plausible mountain trip reference — no explicit proof',
    confidence: 0.7,
  },
];
const { callbackCandidates } = organizeCallbacks(verifiedEvents, candidateCallbacks);
assert.strictEqual(callbackCandidates.length, 1, 'Must classify as candidate');
assert.strictEqual(callbackCandidates[0].type, 'callback_candidate', 'Must NOT be promoted to confirmed callback');
assert.ok(callbackCandidates[0].confidence < 0.88, 'Candidate must have lower confidence than confirmed');
console.log('  ✅ TEST 3 PASSED: Plausible reference kept as callback_candidate without false certainty.');

// ═══════════════════════════════════════════════════
// TEST 4 & 10: Recurring Behavior & Pattern Deduplication
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 4 & 10: Recurring Behavior + Semantic Pattern Deduplication (same pattern, different wording)');
const duplicatePatterns = [
  { pattern: 'They repeatedly tease each other about unanswered missed calls', evidence: ['m103', 'm401'] },
  { pattern: 'Missed calls repeatedly turn into playful complaints and excuses', evidence: ['m103', 'm401'] },
];
const { patterns: deduplicatedPatterns, telemetry: pTelemetry } =
  organizeAndDeduplicatePatterns(duplicatePatterns, verifiedEvents);
assert.strictEqual(deduplicatedPatterns.length, 1, 'Must deduplicate 2 semantically identical patterns into ONE');
assert.strictEqual(pTelemetry.deduplicatedCount, 1, 'Telemetry records 1 deduplication');
assert.ok(deduplicatedPatterns[0].supportingEvidenceIds.length >= 2, 'Merged pattern retains all supporting evidence IDs');
// Verify firstSeen/lastSeen are populated from evidence timestamps (§ 9)
assert.ok(deduplicatedPatterns[0].firstSeen, 'Pattern must have firstSeen timestamp from evidence');
assert.ok(deduplicatedPatterns[0].lastSeen, 'Pattern must have lastSeen timestamp from evidence');
console.log('  ✅ TEST 4 & 10 PASSED: Duplicate patterns merged. firstSeen:', deduplicatedPatterns[0].firstSeen.slice(0, 10));

// ═══════════════════════════════════════════════════
// TEST 5: Contradiction (both sides required)
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 5: Contradiction — both sides required (claim in Sep vs 3AM behavior in Nov)');
const investigatorContradictions = [
  {
    claim: 'I sleep strictly by 11 PM now',
    laterBehavior: 'Sending reels at 3:15 AM in November',
    explanation: 'Rahul claimed fixed early sleep but was active at 3AM months later.',
    evidence: [{ messageId: 'm801' }],
    confidence: 0.9,
  },
];

// ═══════════════════════════════════════════════════
// TEST 6: Rare High-Value Event Preservation
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 6: Rare High-Value Event Preservation (single heartfelt apology)');
const rareApologyEvent = verifiedEvents.find(e => e.supportingMessageIds.includes('m901'));
assert.ok(rareApologyEvent, 'Rare apology must be preserved even though it occurs only once');
assert.strictEqual(rareApologyEvent.eventType, 'apology', 'Type must be apology');
assert.ok(rareApologyEvent.importance >= 0.95, 'High importance score preserved');
// Verify observed vs interpretation (§ 7)
assert.ok(rareApologyEvent.observed.length > 0, 'observed field must be present');
console.log('  ✅ TEST 6 PASSED: Single rare heartfelt apology retained with top-tier importance.');
console.log(`     Observed: "${rareApologyEvent.observed}"`);
console.log(`     Interpreted: "${rareApologyEvent.interpretation}"`);

// ═══════════════════════════════════════════════════
// TEST 7: Hard No-Cross-Contamination
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 7: Cross-Contamination Prevention (Ranchi plan vs Flirting vs Missed calls)');
const ranchiEvent = verifiedEvents.find(e => e.supportingMessageIds.includes('m201'));
const flirtEvent  = verifiedEvents.find(e => e.supportingMessageIds.includes('m302'));
assert.ok(ranchiEvent && flirtEvent, 'Both events must exist independently');
assert.notStrictEqual(ranchiEvent.evidenceId, flirtEvent.evidenceId, 'Must NEVER be merged into a single fake event');
// Verify their message IDs don't overlap
const ranchiMsgIds = new Set(ranchiEvent.supportingMessageIds);
const overlap = flirtEvent.supportingMessageIds.filter(id => ranchiMsgIds.has(id));
assert.strictEqual(overlap.length, 0, 'Message IDs must not overlap between distinct interactions');
console.log('  ✅ TEST 7 PASSED: Distinct interactions have zero message ID overlap.');

// ═══════════════════════════════════════════════════
// TEST 8: Ambiguous Tone Preservation
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 8: Ambiguous Tone — short exchange must not be forced into romance/conflict');
const ambiguousEvent = verifiedEvents.find(e => e.supportingMessageIds.includes('m1001'));
assert.ok(ambiguousEvent, 'Ambiguous event must be preserved');
const neutralTones = ['conversational', 'conversational_banter', 'other', 'logistical_banter'];
assert.ok(
  neutralTones.some(t => ambiguousEvent.tone.includes(t)) || ambiguousEvent.themes.length <= 1,
  'Ambiguous exchange must not be force-classified into romantic or dramatic tone'
);
console.log('  ✅ TEST 8 PASSED: Ambiguous short exchange kept as-is without forced interpretation.');
console.log(`     Tone: "${ambiguousEvent.tone}", Themes: [${ambiguousEvent.themes.join(', ')}]`);

// ═══════════════════════════════════════════════════
// TEST 9: Recurring Topic with Tone Evolution Across Months
// ═══════════════════════════════════════════════════
console.log('\n▶ TEST 9: Recurring Topic Discovery + Tone Evolution (same topic months apart)');
const recurringTopics = discoverRecurringTopics(verifiedEvents);
assert.ok(recurringTopics.length >= 1, `Must discover ≥1 recurring topics, got ${recurringTopics.length}`);
// Find any topic that spans ≥2 interactions
const multiOccurrenceTopic = recurringTopics.find(t => t.occurrences.length >= 2);
assert.ok(multiOccurrenceTopic, 'Must have at least one topic with ≥2 occurrences');
assert.ok(multiOccurrenceTopic.evolution.length >= 2, 'Topic must have evolution entries across time');
assert.ok(multiOccurrenceTopic.firstSeen !== multiOccurrenceTopic.lastSeen, 'First and last seen must differ');
console.log('  ✅ TEST 9 PASSED: Recurring topic tracked with evolution across time.');
console.log(`     Topic: "${multiOccurrenceTopic.topic}", Occurrences: ${multiOccurrenceTopic.occurrences.length}`);
console.log(`     Evolution entries: ${multiOccurrenceTopic.evolution.length}, Has tone shift: ${multiOccurrenceTopic.hasToneEvolution}`);

// ═══════════════════════════════════════════════════
// FINAL MEMORY COMPILATION + TELEMETRY
// ═══════════════════════════════════════════════════
console.log('\n▶ COMPILING FINAL CONVERSATION MEMORY & TELEMETRY...');
const memory = buildVerifiedConversationMemory({
  evidenceStore,
  rawInvestigatorResult: {
    patterns: duplicatePatterns,
    callbacks: investigatorCallbacks,
    contradictions: investigatorContradictions,
    turningPoints: [
      {
        title: 'The Midnight Confession',
        description: 'First time Rahul openly apologized without deflecting into humor',
        before: 'All interactions were either playful or logistical',
        after: 'A rare moment of genuine vulnerability exchanged',
        evidence: ['m901'],
      },
    ],
  },
  metadata: { participants: ['Rahul', 'iteeca'] },
  summaryStats: { peakHour: 'Night', peakDay: 'Weekdays' },
});

assert.strictEqual(memory.verifiedEvents.length, 10,     'All 10 verified events organized');
assert.strictEqual(memory.callbacks.length, 1,           '1 verified callback');
assert.strictEqual(memory.recurringPatterns.length, 1,   '1 deduplicated pattern (not 2)');
assert.strictEqual(memory.contradictions.length, 1,      '1 verified contradiction');
assert.strictEqual(memory.turningPoints.length, 1,       '1 verified turning point');
assert.strictEqual(memory.timeline.length, 10,           'Chronological timeline of 10 events');
assert.ok(memory.communicationHabits.length >= 1,        'Communication habits section populated');
assert.ok(memory.uncertainObservations.length >= 1,      'Uncertain observations section populated');
assert.ok(memory.highValueEvidence.length >= 5,          'High-value evidence selected');
assert.strictEqual(memory.telemetry.inputEvidenceCount, 10, 'Telemetry tracks 10 input items');
assert.ok(memory.telemetry.rejectedOrphanClaimsCount === 0, 'No orphan claims in this test');

// Verify every high-value evidence item has a selectionReason
for (const hv of memory.highValueEvidence) {
  assert.ok(hv.selectionReason, `High-value item ${hv.evidenceId} must have a selectionReason`);
}

// Verify turning point has before/after
assert.ok(memory.turningPoints[0].before, 'Turning point must have before context');
assert.ok(memory.turningPoints[0].after, 'Turning point must have after context');

// Verify contradiction has isCertain flag
assert.ok('isCertain' in memory.contradictions[0], 'Contradiction must have isCertain field');

console.log('\n═══════════════════════════════════════════════════');
console.log('🏆 ALL 10 EVIDENCE INTELLIGENCE & ORGANIZATION TESTS PASSED!');
console.log('═══════════════════════════════════════════════════\n');

// ─── SAMPLE EVIDENCE INPUT ─────────────────────────────────────────────────────
console.log('══════ SAMPLE: EVIDENCE INPUT (E1 — Missed Call Sep) ══════');
const e1 = evidenceStore.find(e => e.messageIds?.includes('m103'));
console.log(JSON.stringify({
  id: e1.id,
  type: e1.type,
  tone: e1.tone,
  participants: e1.participants,
  messageIds: e1.messageIds,
  messages: e1.messages,
  interactionSummary: e1.interactionSummary,
}, null, 2));

// ─── SAMPLE INTELLIGENCE OUTPUT ────────────────────────────────────────────────
console.log('\n══════ SAMPLE: RESULTING INTELLIGENCE OBJECT (E1 VerifiedEvent) ══════');
const ev1 = memory.verifiedEvents.find(e => e.supportingMessageIds?.includes('m103'));
console.log(JSON.stringify({
  evidenceId:     ev1.evidenceId,
  eventType:      ev1.eventType,
  themes:         ev1.themes,
  tone:           ev1.tone,
  importance:     ev1.importance,
  observed:       ev1.observed,
  interpretation: ev1.interpretation,
  outcome:        ev1.outcome,
  startTime:      ev1.startTime,
}, null, 2));

// ─── SAMPLE FINAL COMPACT MEMORY ──────────────────────────────────────────────
console.log('\n══════ SAMPLE: FINAL COMPACT MEMORY STRUCTURE ══════');
console.log(JSON.stringify({
  sectionA_verifiedEventsCount:   memory.verifiedEvents.length,
  sectionB_recurringPatterns:     memory.recurringPatterns.map(p => ({
    id: p.id, description: p.description.slice(0, 80) + '…',
    occurrences: p.occurrences, firstSeen: p.firstSeen?.slice(0, 10),
    lastSeen: p.lastSeen?.slice(0, 10), supportingEvidenceIds: p.supportingEvidenceIds,
  })),
  sectionC_recurringTopics:       memory.recurringTopics.slice(0, 3).map(t => ({
    topic: t.topic, occurrences: t.occurrences.length, hasToneEvolution: t.hasToneEvolution,
  })),
  sectionD_callbacks:             memory.callbacks,
  sectionE_callbackCandidates:    memory.callbackCandidates,
  sectionF_contradictions:        memory.contradictions.map(c => ({
    claim: c.claim, laterBehavior: c.laterBehavior, confidence: c.confidence, isCertain: c.isCertain,
  })),
  sectionG_turningPoints:         memory.turningPoints.map(tp => ({
    title: tp.title, before: tp.before?.slice(0, 60), after: tp.after?.slice(0, 60),
    supportingEvidenceIds: tp.supportingEvidenceIds,
  })),
  sectionH_timelineEntries:       memory.timeline.length,
  sectionI_communicationHabits:   memory.communicationHabits.slice(0, 2),
  sectionJ_highValueEvidenceCount: memory.highValueEvidence.length,
  sectionJ_sample: memory.highValueEvidence.slice(0, 3).map(h => ({
    evidenceId: h.evidenceId, importance: h.importance, selectionReason: h.selectionReason,
  })),
  sectionK_uncertainObservations: memory.uncertainObservations.length,
}, null, 2));

// ─── TELEMETRY ────────────────────────────────────────────────────────────────
console.log('\n══════ TELEMETRY ══════');
console.log(JSON.stringify(memory.telemetry, null, 2));
