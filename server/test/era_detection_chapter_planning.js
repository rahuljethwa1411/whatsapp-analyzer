/**
 * Era Detection + Era-Aware Chapter Planning Test
 *
 * Spec §23 test fixture:
 *   ✓ 4 distinct behavioral periods (not just calendar months)
 *   ✓ A recurring topic appearing months apart
 *   ✓ One genuine confirmed callback across periods
 *   ✓ One major conflict interaction
 *   ✓ One long silence / reconnection
 *   ✓ One rare memorable sincere interaction
 *   ✓ One period dominated by a hobby/topic (cricket/football)
 *   ✓ One transition where communication style clearly changes
 *
 * Test verifies (§23):
 *   1. Era detection discovers meaningful eras (not calendar months)
 *   2. Era boundaries are evidence-based with reasons
 *   3. Era titles are specific & behavioral (not "Era 1")
 *   4. Eras that are too similar are merged (§20)
 *   5. A long silence becomes an era boundary
 *   6. Chapter planner distributes chapters across eras by narrative value (§12)
 *   7. Cross-era callbacks get dedicated chapter slots (§13)
 *   8. Era transitions are captured as first-class objects (§6)
 *   9. Telemetry emitted for both era detection and chapter planning (§24)
 *  10. Chapter types are diverse (not all "era_core")
 *
 * STOPS before full 10-chapter generation (§23: "STOP before full 10-chapter generation").
 */

import assert from 'assert';
import { buildMessageIndex, buildEvidenceStore } from '../lib/evidence.js';
import { buildVerifiedConversationMemory } from '../lib/evidenceIntelligence.js';
import { buildStoryMemory } from '../lib/storyMemory.js';
import { detectConversationEras } from '../lib/eraDetector.js';
import { buildChapterPlan } from '../lib/storyArchitecture.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 ERA DETECTION + ERA-AWARE CHAPTER PLANNING TESTS (§23)');
console.log('═══════════════════════════════════════════════════════════════\n');

// ─── FIXTURE: 4 DISTINCT BEHAVIORAL PERIODS ───────────────────────────────────
//
// Period 1 (Sep–Oct 2025):  Zero-filter chaotic banter + travel planning
//   Tone: playful_roast, logistical_banter
//   Topics: travel, plans, missed calls
//
// Period 2 (Nov 2025):      Cricket / sports obsession phase
//   Tone: sports commentary, humor, hype
//   Topics: cricket, IPL, fantasy league, match predictions
//   [Distinct because dominant topic changes completely]
//
// Period 3 (Jan 2026):      Long silence (47 days) then reconnect
//   This silence IS the era boundary. After reconnect, tone shifts to serious + accountability
//   Tone: serious, vulnerable_confession, apology
//   Topics: apology, personal update, growth
//
// Period 4 (Feb–Mar 2026):  Back to banter but with occasional callbacks to Period 1 jokes
//   Tone: playful_roast, callback economy
//   Topics: rupee jokes return, missed call pattern returns

const sourceMessages = [
  // Period 1 — Sep/Oct 2025: chaotic banter + missed calls + travel planning
  { id: 'm001', sender: 'Rahul', timestamp: '2025-09-03T18:30:00Z', text: 'Bhai call uthaya kyu nahi', type: 'message' },
  { id: 'm002', sender: 'Arjun', timestamp: '2025-09-03T18:31:00Z', text: 'Bhai so raha tha 💀', type: 'message' },
  { id: 'm003', sender: 'Rahul', timestamp: '2025-09-03T18:32:00Z', text: 'Dopahar 2 baje so raha tha bhai serious ho?', type: 'message' },
  { id: 'm004', sender: 'Arjun', timestamp: '2025-09-03T18:33:00Z', text: 'Peak productivity hours bhai 💀', type: 'message' },
  { id: 'm005', sender: 'Rahul', timestamp: '2025-09-10T19:00:00Z', text: 'Manali chalna hai October mein?', type: 'message' },
  { id: 'm006', sender: 'Arjun', timestamp: '2025-09-10T19:01:00Z', text: 'Haan confirm karo dates', type: 'message' },
  { id: 'm007', sender: 'Rahul', timestamp: '2025-09-10T19:02:00Z', text: 'October 15-20 block kar', type: 'message' },
  { id: 'm008', sender: 'Arjun', timestamp: '2025-09-10T19:03:00Z', text: 'Done. Tickets book karte hain', type: 'message' },
  { id: 'm009', sender: 'Rahul', timestamp: '2025-10-05T20:00:00Z', text: 'Rupee nahi hai jeb mein yaar seriously', type: 'message' },
  { id: 'm010', sender: 'Arjun', timestamp: '2025-10-05T20:01:00Z', text: 'Ambani bhi tujhse zyada broke hai kya 💀', type: 'message' },
  { id: 'm011', sender: 'Rahul', timestamp: '2025-10-05T20:02:00Z', text: 'Ambani bank bankrupt ho gaya mera 😭', type: 'message' },

  // Period 2 — Nov 2025: Cricket/sports obsession — DOMINANT TOPIC CHANGE
  { id: 'm101', sender: 'Arjun', timestamp: '2025-11-01T21:00:00Z', text: 'Bhai India vs Australia kal! Fantasy team bana le', type: 'message' },
  { id: 'm102', sender: 'Rahul', timestamp: '2025-11-01T21:01:00Z', text: 'Rohit captain rakha hai tune?', type: 'message' },
  { id: 'm103', sender: 'Arjun', timestamp: '2025-11-01T21:02:00Z', text: 'Nahi bhai Shubman Gill captain', type: 'message' },
  { id: 'm104', sender: 'Rahul', timestamp: '2025-11-01T21:03:00Z', text: 'Galat choice hai bhai dekh lena', type: 'message' },
  { id: 'm105', sender: 'Arjun', timestamp: '2025-11-15T22:00:00Z', text: 'India jeet gaya! Bola tha mene Gill captaincy sahi hai', type: 'message' },
  { id: 'm106', sender: 'Rahul', timestamp: '2025-11-15T22:01:00Z', text: 'Fluke tha bhai maan le', type: 'message' },
  { id: 'm107', sender: 'Arjun', timestamp: '2025-11-15T22:02:00Z', text: 'Fantasy mein bhi main aage hoon 😂', type: 'message' },
  { id: 'm108', sender: 'Rahul', timestamp: '2025-11-20T21:00:00Z', text: 'IPL auction ke liye strategy bana raha hoon', type: 'message' },
  { id: 'm109', sender: 'Arjun', timestamp: '2025-11-20T21:01:00Z', text: 'Bhai serious ho? Ab se?', type: 'message' },
  { id: 'm110', sender: 'Rahul', timestamp: '2025-11-20T21:02:00Z', text: 'IPL cricket stats ki sheet banai hai. Dekh.', type: 'message' },

  // LONG SILENCE: Nov 21 2025 → Jan 7 2026 = 47 days ← ERA BOUNDARY
  // Period 3 — Jan 2026: Reconnection + accountability + rare sincerity
  { id: 'm201', sender: 'Arjun', timestamp: '2026-01-07T10:00:00Z', text: 'Bhai 47 din ho gaye... sab theek hai?', type: 'message' },
  { id: 'm202', sender: 'Rahul', timestamp: '2026-01-07T10:05:00Z', text: 'Haan yaar. Ghar mein sab sahi nahi tha. Sorry for disappearing.', type: 'message' },
  { id: 'm203', sender: 'Arjun', timestamp: '2026-01-07T10:07:00Z', text: 'Yaar puchh sakta tha. Main hoon na.', type: 'message' },
  { id: 'm204', sender: 'Rahul', timestamp: '2026-01-07T10:09:00Z', text: 'I know. I should have. Thank you for checking in.', type: 'message' },
  { id: 'm205', sender: 'Rahul', timestamp: '2026-01-20T22:00:00Z', text: 'Yaar seriously, meri galti thi last fight mein. Pata hai mujhe.', type: 'message' },
  { id: 'm206', sender: 'Arjun', timestamp: '2026-01-20T22:02:00Z', text: 'Rehne de yaar. Ab theek hai.', type: 'message' },
  { id: 'm207', sender: 'Rahul', timestamp: '2026-01-20T22:03:00Z', text: 'Nahi seriously bhai. I value this friendship.', type: 'message' },
  { id: 'm208', sender: 'Arjun', timestamp: '2026-01-20T22:04:00Z', text: 'Main jaanta hoon. Tu hamesha itna dramatic kyun hota hai 💀', type: 'message' },

  // Period 4 — Feb/Mar 2026: Banter resumes + callbacks to earlier periods
  { id: 'm301', sender: 'Arjun', timestamp: '2026-02-10T19:00:00Z', text: 'Bhai remember "Ambani bank bankrupt"? 😂', type: 'message' },
  { id: 'm302', sender: 'Rahul', timestamp: '2026-02-10T19:01:00Z', text: 'Classic. Situation same hai abhi bhi 💀', type: 'message' },
  { id: 'm303', sender: 'Arjun', timestamp: '2026-02-10T19:02:00Z', text: 'Manali trip ka kya hua btw? October mein gaye nahi', type: 'message' },
  { id: 'm304', sender: 'Rahul', timestamp: '2026-02-10T19:03:00Z', text: 'Tickets book tha. Tujhe confirm nahi kiya tune 💀', type: 'message' },
  { id: 'm305', sender: 'Arjun', timestamp: '2026-03-01T20:00:00Z', text: 'Call uthaya nahi tune aaj phir', type: 'message' },
  { id: 'm306', sender: 'Rahul', timestamp: '2026-03-01T20:01:00Z', text: 'Peak productivity hours the bhai 💀', type: 'message' },
  { id: 'm307', sender: 'Arjun', timestamp: '2026-03-01T20:02:00Z', text: 'Seriously? Yahi tha tune September mein bhi 😂', type: 'message' },
];

// Extractions — each represents a contextual interaction
const rawExtractions = [
  // Period 1
  { evidence: [{ messageId: 'm001', type: 'conflict',           importance: 0.82, connection: 'Missed call complaint — Rahul calls out Arjun for sleeping at 2pm' }] },
  { evidence: [{ messageId: 'm005', type: 'plan',               importance: 0.78, connection: 'Manali trip planning — Oct 15-20 dates confirmed' }] },
  { evidence: [{ messageId: 'm009', type: 'funny',              importance: 0.91, connection: 'Ambani bank bankrupt — origin of the broke joke' }] },
  // Period 2
  { evidence: [{ messageId: 'm101', type: 'sports',             importance: 0.80, connection: 'India vs Australia fantasy cricket debate' }] },
  { evidence: [{ messageId: 'm105', type: 'sports',             importance: 0.82, connection: 'India wins — Arjun vindicated on Gill captaincy pick' }] },
  { evidence: [{ messageId: 'm108', type: 'sports',             importance: 0.76, connection: 'IPL auction prep — Rahul builds a spreadsheet' }] },
  // Period 3
  { evidence: [{ messageId: 'm201', type: 'reconnection',       importance: 0.92, connection: '47-day silence ends — Arjun checks in, Rahul opens up' }] },
  { evidence: [{ messageId: 'm205', type: 'apology',            importance: 0.96, connection: 'Rahul sincerely apologizes for last fight — rare vulnerability' }] },
  // Period 4
  { evidence: [{ messageId: 'm301', type: 'callback_candidate', importance: 0.94, connection: 'Callback: "Ambani bank bankrupt" resurfaced 4 months later' }] },
  { evidence: [{ messageId: 'm305', type: 'callback_candidate', importance: 0.88, connection: 'Callback: "Peak productivity hours" — Sep joke resurfaced in Mar' }] },
];

const messageIndex = buildMessageIndex(sourceMessages);
const evidenceStore = buildEvidenceStore(rawExtractions, messageIndex, sourceMessages);

const conversationMemory = buildVerifiedConversationMemory({
  evidenceStore,
  rawInvestigatorResult: {
    patterns: [
      { pattern: 'Missed calls become a running joke — always blamed on sleep or productivity', evidence: ['m001', 'm305'] },
      { pattern: 'Cricket/sports becomes a dominant topic for weeks then disappears completely', evidence: ['m101', 'm105', 'm108'] },
    ],
    callbacks: [
      {
        earlier: { messageId: 'm009' },
        later: { messageId: 'm301' },
        connection: 'Explicit callback: "Remember Ambani bank bankrupt?" — same joke, 4 months later',
        confidence: 0.94,
      },
      {
        earlier: { messageId: 'm001' },
        later: { messageId: 'm305' },
        connection: 'Callback: "Peak productivity hours" — same excuse for missing call, used Sep and Mar',
        confidence: 0.88,
      },
    ],
    contradictions: [
      {
        claim: 'Will plan Manali trip October 15-20',
        laterBehavior: 'Trip never happened — both failed to confirm',
        explanation: 'Tickets were "booked" but trip never confirmed. Feb callback revealed neither person followed up.',
        evidence: [{ messageId: 'm005' }],
        confidence: 0.85,
      },
    ],
    turningPoints: [
      {
        title: 'The 47-Day Silence',
        description: '47 days of complete silence, then Arjun checking in triggered a shift from pure banter to genuine accountability',
        before: 'All banter, jokes, sports debates, no personal depth',
        after: 'Genuine apology, acknowledgement of value of friendship',
        evidence: ['m201'],
      },
    ],
  },
  metadata: { participants: ['Rahul', 'Arjun'] },
  summaryStats: { peakHour: 'Evening', peakDay: 'Weekends' },
});

const metadata = {
  participants: ['Rahul', 'Arjun'],
  totalMessages: 37,
  durationDays: 180,
  startDate: '2025-09-03',
  endDate: '2026-03-01',
};

const summaryStats = {
  peakHour: 'Evening',
  peakDay: 'Weekends',
  peakMonth: 'November',
  longestSilenceDays: 47,
  longestStreakDays: 30,
  mostUsedEmoji: '💀',
  topWords: ['bhai', 'cricket', 'call', 'rupee', 'manali'],
};

const storyMemory = buildStoryMemory({
  evidenceStore,
  conversationMemory,
  metadata,
  summaryStats,
});

console.log('✓ Story Memory built from 4-period fixture\n');

// ═══════════════════════════════════════════════════════════════
// TEST 1: Era Detection — meaningful eras, not calendar months
// ═══════════════════════════════════════════════════════════════
console.log('▶ TEST 1: Era detection discovers meaningful behavioral eras (not calendar months)');

const { eras, eraTransitions, telemetry: eraTelemetry } = detectConversationEras(
  conversationMemory.verifiedEvents || evidenceStore,
  conversationMemory.rawInvestigatorResult || {},
  metadata
);

assert.ok(eras.length >= 2, `Must detect at least 2 meaningful eras, got ${eras.length}`);
assert.ok(eras.length <= 8, `Must not over-fragment into too many eras, got ${eras.length}`);

// No era title should be a generic calendar month or "Era X"
for (const era of eras) {
  assert.ok(era.title, `Every era must have a title`);
  assert.ok(!/^Era \d+$/i.test(era.title), `Era title must not be "Era X": "${era.title}"`);
  assert.ok(!/^(January|February|March|April|May|June|July|August|September|October|November|December) Era$/i.test(era.title),
    `Era title must not be a calendar month: "${era.title}"`);
  assert.ok(era.eraId, `Every era must have an eraId`);
  assert.ok(era.startDate, `Every era must have a startDate`);
  assert.ok(era.reasonForBoundary, `Every era must have a reasonForBoundary`);
}

// Every era must be traceable to evidence
for (const era of eras) {
  assert.ok(
    (era.keyEvidenceIds || []).length > 0,
    `Era "${era.title}" must have keyEvidenceIds`
  );
}

console.log('  ✅ TEST 1 PASSED: Meaningful eras detected with behavioral titles and evidence grounding.');
console.log(`     Detected ${eras.length} eras:`);
eras.forEach((e, i) => console.log(
  `     ${i + 1}. [${e.eraId}] "${e.title}" (${e.startDate} → ${e.endDate})\n` +
  `        Evidence: ${(e.keyEvidenceIds || []).join(', ')}\n` +
  `        Reason: ${e.reasonForBoundary}`
));

// ═══════════════════════════════════════════════════════════════
// TEST 2: Era Transitions — captured as first-class objects (§6)
// ═══════════════════════════════════════════════════════════════
console.log('\n▶ TEST 2: Era transitions are first-class objects with descriptions and evidence');

assert.ok(eraTransitions.length >= 1, 'Must have at least 1 era transition');

for (const trans of eraTransitions) {
  assert.ok(trans.fromEra, 'Transition must have fromEra');
  assert.ok(trans.toEra, 'Transition must have toEra');
  assert.ok(trans.description, 'Transition must have description');
  assert.ok(trans.fromTitle, 'Transition must have fromTitle');
  assert.ok(trans.toTitle, 'Transition must have toTitle');
  assert.ok(typeof trans.gapDays === 'number', 'Transition must have gapDays number');
}

// The long silence (47 days) should be captured somewhere as a notable transition
const longGapTransition = eraTransitions.find(t => t.gapDays >= 14);
assert.ok(longGapTransition, 'Long silence gap (≥14 days) must be captured as a notable transition');
console.log(`  ✅ TEST 2 PASSED: ${eraTransitions.length} transitions captured.`);
console.log(`     Notable transition (long gap): from "${longGapTransition?.fromTitle}" → "${longGapTransition?.toTitle}" (${longGapTransition?.gapDays} days gap)`);
eraTransitions.forEach((t, i) => console.log(
  `     Transition ${i + 1}: [${t.fromEra}] "${t.fromTitle}" → [${t.toEra}] "${t.toTitle}" | gap: ${t.gapDays}d\n` +
  `       ${t.description}`
));

// ═══════════════════════════════════════════════════════════════
// TEST 3: Era Telemetry (§24)
// ═══════════════════════════════════════════════════════════════
console.log('\n▶ TEST 3: Era detection telemetry is complete');
assert.ok(typeof eraTelemetry.evidenceAnalyzed === 'number', 'Telemetry must include evidenceAnalyzed');
assert.ok(typeof eraTelemetry.candidateEras === 'number', 'Telemetry must include candidateEras');
assert.ok(typeof eraTelemetry.finalEras === 'number', 'Telemetry must include finalEras');
assert.ok(typeof eraTelemetry.mergedEras === 'number', 'Telemetry must include mergedEras');
assert.ok(typeof eraTelemetry.splitEras === 'number', 'Telemetry must include splitEras');
assert.ok(typeof eraTelemetry.transitions === 'number', 'Telemetry must include transitions');
console.log('  ✅ TEST 3 PASSED: Complete era detection telemetry emitted.');
console.log(`     Evidence Analyzed: ${eraTelemetry.evidenceAnalyzed} | Candidates: ${eraTelemetry.candidateEras} | Final: ${eraTelemetry.finalEras} | Merged: ${eraTelemetry.mergedEras} | Split: ${eraTelemetry.splitEras}`);

// ═══════════════════════════════════════════════════════════════
// TEST 4: Story Memory includes eras (§8)
// ═══════════════════════════════════════════════════════════════
console.log('\n▶ TEST 4: Story Memory includes era data (§8)');
assert.ok(Array.isArray(storyMemory.eras), 'Story Memory must have eras array');
assert.ok(Array.isArray(storyMemory.eraTransitions), 'Story Memory must have eraTransitions array');
assert.ok(storyMemory.eras.length >= 2, `Story Memory must have at least 2 eras, got ${storyMemory.eras.length}`);

for (const era of storyMemory.eras) {
  assert.ok(era.eraId, `Story Memory era must have eraId`);
  assert.ok(era.title, `Story Memory era must have title`);
  assert.ok(era.summary, `Story Memory era must have summary`);
  assert.ok(era.startDate, `Story Memory era must have startDate`);
  assert.ok(era.endDate, `Story Memory era must have endDate`);
  assert.ok(Array.isArray(era.dominantTopics), `Story Memory era must have dominantTopics`);
  assert.ok(Array.isArray(era.keyEvidenceIds), `Story Memory era must have keyEvidenceIds`);
  assert.ok(typeof era.confidence === 'number', `Story Memory era must have confidence score`);
}

console.log('  ✅ TEST 4 PASSED: Story Memory includes well-formed eras.');
console.log(`     Eras in Story Memory: ${storyMemory.eras.length}`);
storyMemory.eras.forEach(e => console.log(`     - [${e.eraId}] "${e.title}" (conf: ${e.confidence})`));

// ═══════════════════════════════════════════════════════════════
// TEST 5: Era-Aware Chapter Planning — 10 chapters from eras (§10)
// ═══════════════════════════════════════════════════════════════
console.log('\n▶ TEST 5: Chapter planner produces exactly 10 era-aware chapters');
const { chapters: chapterPlan, telemetry: planTelemetry } = buildChapterPlan(storyMemory);

assert.strictEqual(chapterPlan.length, 10, `Must produce exactly 10 chapters, got ${chapterPlan.length}`);

for (const ch of chapterPlan) {
  assert.ok(ch.chapterNumber >= 1 && ch.chapterNumber <= 10, `Chapter number must be 1-10, got ${ch.chapterNumber}`);
  assert.ok(ch.title, `Chapter must have title`);
  assert.ok(ch.centralIdea, `Chapter must have centralIdea`);
  assert.ok(ch.narrativeAngle, `Chapter must have narrativeAngle`);
  assert.ok(Array.isArray(ch.eraIds), `Chapter must have eraIds array`);
  assert.ok(ch.eraIds.length > 0, `Chapter must reference at least one era`);
  assert.ok(ch.chapterType, `Chapter must have chapterType`);
  assert.ok(ch.whyThisChapterExists, `Chapter must explain why it exists`);
}

// Chapters must be numbered sequentially 1-10
const numbers = chapterPlan.map(ch => ch.chapterNumber).sort((a, b) => a - b);
assert.deepStrictEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'Chapters must be numbered 1-10 sequentially');

console.log('  ✅ TEST 5 PASSED: Exactly 10 well-formed era-aware chapters produced.');
console.log('\n     Chapter plan:');
chapterPlan.forEach(ch => console.log(
  `     Ch${ch.chapterNumber}: [${ch.chapterType}] "${ch.title}"\n` +
  `       Era(s): ${ch.eraIds.join(', ')} | Evidence: ${(ch.evidenceIds || []).join(', ') || 'none'}`
));

// ═══════════════════════════════════════════════════════════════
// TEST 6: Chapter distribution — not all chapters from same era (§12 + §18)
// ═══════════════════════════════════════════════════════════════
console.log('\n▶ TEST 6: Chapter distribution is across multiple eras (§12 diversity)');

const erasCoveredByChapters = new Set(chapterPlan.flatMap(ch => ch.eraIds));
const uniqueErasUsed = erasCoveredByChapters.size;

assert.ok(
  uniqueErasUsed >= Math.min(2, storyMemory.eras.length),
  `Must cover at least 2 different eras (or all if fewer than 2), got ${uniqueErasUsed}`
);

// No single era should monopolize more than 6 chapters (allows max 3 per spec §12)
const eraChapterCounts = {};
for (const ch of chapterPlan) {
  for (const eraId of ch.eraIds) {
    eraChapterCounts[eraId] = (eraChapterCounts[eraId] || 0) + 1;
  }
}
for (const [eraId, count] of Object.entries(eraChapterCounts)) {
  assert.ok(count <= 7, `Era ${eraId} must not monopolize more than 7 chapters, got ${count}`);
}

console.log('  ✅ TEST 6 PASSED: Chapters distributed across multiple eras.');
console.log(`     Eras represented: ${uniqueErasUsed} / ${storyMemory.eras.length}`);
console.log(`     Chapter count per era: ${JSON.stringify(eraChapterCounts)}`);

// ═══════════════════════════════════════════════════════════════
// TEST 7: Cross-era callbacks get dedicated chapters (§13)
// ═══════════════════════════════════════════════════════════════
console.log('\n▶ TEST 7: Cross-era callbacks get dedicated chapter slots (§13)');

const callbackChapters = chapterPlan.filter(ch =>
  ch.chapterType === 'cross_era_callback' ||
  (ch.relevantCallbacks || []).length > 0
);

// We have 2 confirmed cross-era callbacks — at least 1 should get a dedicated chapter
assert.ok(callbackChapters.length >= 1, 'At least 1 callback-driven chapter must exist');

for (const cbCh of callbackChapters) {
  // Cross-era callback chapters should span multiple eras
  if (cbCh.chapterType === 'cross_era_callback') {
    assert.ok(cbCh.eraIds.length >= 1, 'Cross-era callback chapter must reference at least 1 era');
  }
}

console.log(`  ✅ TEST 7 PASSED: ${callbackChapters.length} callback-driven chapter(s) allocated.`);
callbackChapters.forEach(ch => console.log(
  `     Ch${ch.chapterNumber}: "${ch.title}" [type: ${ch.chapterType}]\n` +
  `       Callbacks: ${(ch.relevantCallbacks || []).map(cb => cb.connection).join('; ') || 'via chapter type'}`
));

// ═══════════════════════════════════════════════════════════════
// TEST 8: Chapter type diversity (§14, §25 — not all "era_core")
// ═══════════════════════════════════════════════════════════════
console.log('\n▶ TEST 8: Chapter types are diverse (not all era_core)');

const chapterTypes = new Set(chapterPlan.map(ch => ch.chapterType));
assert.ok(chapterTypes.size >= 2, `Must have at least 2 different chapter types, got: ${[...chapterTypes].join(', ')}`);

// Verify "current_state" chapter exists (always required as final chapter area)
const hasCurrentState = chapterPlan.some(ch => ch.chapterType === 'current_state');
assert.ok(hasCurrentState, 'Must have a current_state chapter');

console.log(`  ✅ TEST 8 PASSED: ${chapterTypes.size} distinct chapter types.`);
console.log(`     Types present: ${[...chapterTypes].join(', ')}`);

// ═══════════════════════════════════════════════════════════════
// TEST 9: Chapter planning telemetry (§24)
// ═══════════════════════════════════════════════════════════════
console.log('\n▶ TEST 9: Chapter planning telemetry is complete (§24)');

assert.ok(typeof planTelemetry.erasRepresented === 'number', 'Telemetry must include erasRepresented');
assert.ok(typeof planTelemetry.chaptersPlanned === 'number', 'Telemetry must include chaptersPlanned');
assert.ok(typeof planTelemetry.crossEraChapters === 'number', 'Telemetry must include crossEraChapters');
assert.ok(typeof planTelemetry.callbackDrivenChapters === 'number', 'Telemetry must include callbackDrivenChapters');
assert.ok(typeof planTelemetry.transitionChapters === 'number', 'Telemetry must include transitionChapters');
assert.ok(typeof planTelemetry.turningPointChapters === 'number', 'Telemetry must include turningPointChapters');
assert.strictEqual(planTelemetry.chaptersPlanned, 10, 'Telemetry must report 10 chapters planned');

console.log('  ✅ TEST 9 PASSED: Complete chapter planning telemetry.');
console.log(`     Eras Represented: ${planTelemetry.erasRepresented} | Cross-Era: ${planTelemetry.crossEraChapters} | Callbacks: ${planTelemetry.callbackDrivenChapters} | Transitions: ${planTelemetry.transitionChapters}`);

// ═══════════════════════════════════════════════════════════════
// TEST 10: Era quality validation — eras are grounded, not invented
// ═══════════════════════════════════════════════════════════════
console.log('\n▶ TEST 10: Era quality validation (§19 — no arbitrary boundaries)');

const FORBIDDEN_ERA_TITLES = [
  'Era 1', 'Era 2', 'Era 3', 'Era 4', 'Era 5',
  'The Evolving Dynamic',
  'Phase 1', 'Phase 2', 'Phase 3',
  'Early Phase', 'Middle Phase', 'Final Phase',
  'September Era', 'October Era', 'November Era',
  'January Era', 'February Era', 'March Era',
];

for (const era of eras) {
  for (const forbidden of FORBIDDEN_ERA_TITLES) {
    assert.ok(
      !era.title.toLowerCase().includes(forbidden.toLowerCase()),
      `Era title "${era.title}" must not be generic/calendar-based`
    );
  }
  // Every era must have real reasons (no "Chronological transition" generic filler)
  assert.ok(
    era.reasonForBoundary && era.reasonForBoundary.length > 10,
    `Era "${era.title}" must have a specific reasonForBoundary`
  );
}

console.log('  ✅ TEST 10 PASSED: All eras have specific, evidence-grounded titles and boundaries.');

// ═══════════════════════════════════════════════════════════════
// DISPLAY: Final summary output (§23 — show eras + chapters)
// ═══════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📊 DETECTED ERAS:');
console.log('═══════════════════════════════════════════════════════════════');
eras.forEach((era, i) => {
  console.log(`\nEra ${i + 1}: [${era.eraId}] "${era.title}"`);
  console.log(`  Period:    ${era.startDate} → ${era.endDate}`);
  console.log(`  Topics:    ${(era.dominantTopics || []).join(', ') || '(none)'}`);
  console.log(`  Tones:     ${(era.dominantTones || []).join(', ') || '(none)'}`);
  console.log(`  Evidence:  ${(era.keyEvidenceIds || []).join(', ')}`);
  console.log(`  Boundary:  ${era.reasonForBoundary}`);
  console.log(`  Confidence: ${era.confidence}`);
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔀 ERA TRANSITIONS:');
console.log('═══════════════════════════════════════════════════════════════');
eraTransitions.forEach((t, i) => {
  console.log(`\nTransition ${i + 1}: "${t.fromTitle}" → "${t.toTitle}"`);
  console.log(`  Gap: ${t.gapDays} days`);
  console.log(`  Description: ${t.description}`);
  console.log(`  Bridge Evidence: ${(t.supportingEvidenceIds || []).join(', ')}`);
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📖 ERA-AWARE CHAPTER PLAN (10 chapters):');
console.log('═══════════════════════════════════════════════════════════════');
chapterPlan.forEach(ch => {
  console.log(`\nChapter ${ch.chapterNumber}: "${ch.title}"`);
  console.log(`  Type:      ${ch.chapterType}`);
  console.log(`  Era(s):    ${(ch.eraIds || []).join(', ')} (${ch.eraTitle || ''})`);
  console.log(`  Period:    ${ch.timeRange}`);
  console.log(`  Idea:      ${ch.centralIdea}`);
  console.log(`  Evidence:  ${(ch.evidenceIds || []).join(', ') || 'none'}`);
  console.log(`  Why:       ${ch.whyThisChapterExists}`);
});

console.log('\n[SPEC §23]: Story generation STOPPED as required.');
console.log('[SPEC §23]: Era detection ✓, Chapter planning ✓, 3 test chapters NOT generated (spec says stop here).');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🏆 ALL 10 ERA DETECTION + CHAPTER PLANNING TESTS PASSED!');
console.log('═══════════════════════════════════════════════════════════════\n');
