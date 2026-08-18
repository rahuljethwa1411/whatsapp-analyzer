import assert from 'assert';
import { buildMessageIndex, buildEvidenceStore } from '../lib/evidence.js';
import { buildVerifiedConversationMemory } from '../lib/evidenceIntelligence.js';
import { detectConversationEras } from '../lib/eraDetector.js';
import { buildStoryMemory } from '../lib/storyMemory.js';
import { buildChapterPlan, buildChapterSpecificPromptContext } from '../lib/storyArchitecture.js';
import { getOpenAIService } from '../lib/ai/openaiClient.js';
import { buildStorySystemPrompt, buildStoryUserPrompt } from '../lib/ai/prompts/storyPrompt.js';
import { getModelForTier } from '../lib/ai/modelConfig.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 SCENE BOUNDARY & NON-STITCHING 3-TEST SUITE');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── TEST FIXTURE (Covering Tests 1, 2, and 3) ─────────────────────────────────
const sourceMessages = [
  // TEST 1: Gift at 16:02 vs Vinicius at 16:15 on same day (Oct 09)
  { id: 'm101', sender: 'Rahul', timestamp: '2025-10-09T16:00:00Z', text: 'itne pyaar se diya yaar', type: 'message' },
  { id: 'm102', sender: 'iteeca', timestamp: '2025-10-09T16:02:00Z', text: 'Arey kr lungi bhaiz bhejungi tujhe krke', type: 'message' },

  { id: 'm103', sender: 'Rahul', timestamp: '2025-10-09T16:15:00Z', text: 'BHAIII do u remember vinicius jr from real madrid', type: 'message' },
  { id: 'm104', sender: 'iteeca', timestamp: '2025-10-09T16:16:00Z', text: 'The black guy? Hnn', type: 'message' },
  { id: 'm105', sender: 'Rahul', timestamp: '2025-10-09T16:17:00Z', text: 'uski private chats leak hui hai', type: 'message' },
  { id: 'm106', sender: 'iteeca', timestamp: '2025-10-09T16:18:00Z', text: '😭😭😭😭😐 Ayooooo', type: 'message' },

  // TEST 2: January vs April Cricket topic (Recurring topic, not same convo)
  { id: 'm201', sender: 'iteeca', timestamp: '2026-01-25T18:00:00Z', text: 'Abhishek Sharma 68 in 20 balls bro! I think yuvi still tops', type: 'message' },
  { id: 'm202', sender: 'Rahul', timestamp: '2026-01-25T18:02:00Z', text: '12 me tha yuvi ka', type: 'message' },
  { id: 'm203', sender: 'iteeca', timestamp: '2026-01-25T18:03:00Z', text: '13 or 14 balls ig', type: 'message' },
  { id: 'm204', sender: 'Rahul', timestamp: '2026-01-25T18:04:00Z', text: 'kya kirket fan banegi tu', type: 'message' },

  { id: 'm205', sender: 'Rahul', timestamp: '2026-04-12T19:00:00Z', text: 'Kohli 100 off 58 balls in IPL today', type: 'message' },
  { id: 'm206', sender: 'iteeca', timestamp: '2026-04-12T19:02:00Z', text: 'King for a reason 😎', type: 'message' },
  { id: 'm207', sender: 'Rahul', timestamp: '2026-04-12T19:03:00Z', text: 'still slower than yuvi records haha', type: 'message' },

  // TEST 3: Confirmed Callback (100-Rupee broke joke Oct 15 -> Feb 14)
  { id: 'm301', sender: 'Rahul', timestamp: '2025-10-15T21:00:00Z', text: 'Can you order the dessert?', type: 'message' },
  { id: 'm302', sender: 'iteeca', timestamp: '2025-10-15T21:01:00Z', text: 'Saale 100 rupee bhi nahi hai jeb mein', type: 'message' },
  { id: 'm303', sender: 'Rahul', timestamp: '2025-10-15T21:02:00Z', text: 'Ambani bank bankrupt ho gaya kya', type: 'message' },

  { id: 'm304', sender: 'Rahul', timestamp: '2026-02-14T20:00:00Z', text: 'Concert tickets lene ka plan hai kya?', type: 'message' },
  { id: 'm305', sender: 'iteeca', timestamp: '2026-02-14T20:02:00Z', text: 'Remember when I said 100 rupee bhi nahi hai jeb mein?', type: 'message' },
  { id: 'm306', sender: 'iteeca', timestamp: '2026-02-14T20:03:00Z', text: 'Ambani bank is still bankrupt 😂', type: 'message' },
];

const messageIndex = buildMessageIndex(sourceMessages);

const rawExtractions = [
  { evidence: [{ messageId: 'm101', type: 'gift', importance: 0.88, connection: 'Gift logistics exchange at 16:02' }] },
  { evidence: [{ messageId: 'm103', type: 'gossip', importance: 0.90, connection: 'Vinicius private chats gossip at 16:15' }] },
  { evidence: [{ messageId: 'm201', type: 'sports', importance: 0.84, connection: 'January cricket discussion' }] },
  { evidence: [{ messageId: 'm205', type: 'sports', importance: 0.85, connection: 'April cricket discussion' }] },
  { evidence: [{ messageId: 'm301', type: 'funny', importance: 0.94, connection: 'Origin: 100 rupee broke joke' }] },
  { evidence: [{ messageId: 'm304', type: 'callback_candidate', importance: 0.98, connection: 'Explicit callback: 100 rupee joke 4 months later' }] },
];

const evidenceStore = buildEvidenceStore(rawExtractions, messageIndex, sourceMessages);

const metadata = {
  totalMessages: sourceMessages.length,
  totalParticipants: 2,
  participants: ['Rahul', 'iteeca'],
  durationDays: 190,
  startDate: '2025-10-09',
  endDate: '2026-04-12',
};

const summaryStats = {
  peakHour: '16:00',
  peakDay: 'Thursday',
  peakMonth: 'October 2025',
  longestSilenceDays: 30,
  longestStreakDays: 20,
  mostUsedEmoji: '😭',
  topWords: ['bhai', 'yaar', 'bro'],
};

const conversationMemory = buildVerifiedConversationMemory({
  evidenceStore,
  rawInvestigatorResult: {
    patterns: [
      { pattern: 'Financial self-deprecation as an excuse for outings', evidence: ['m301', 'm304'] },
      { pattern: 'Cricket banter resurfacing periodically', evidence: ['m201', 'm205'] },
    ],
    callbacks: [
      {
        earlier: { messageId: 'm301' },
        later: { messageId: 'm304' },
        connection: 'Explicit callback: "Remember when I said 100 rupee..." — directly resurrecting the Oct joke in Feb',
        confidence: 0.98,
      },
    ],
    contradictions: [],
  },
  metadata,
  summaryStats,
});

const storyMemory = buildStoryMemory({
  evidenceStore,
  conversationMemory,
  metadata,
  summaryStats,
});

const { chapters: chapterPlan } = buildChapterPlan(storyMemory);

console.log('[1] Planned Chapters with Scene Objects:');
chapterPlan.slice(0, 3).forEach((ch, idx) => {
  console.log(`\n── CHAPTER ${idx + 1}: ${ch.title} (${ch.chapterType}) ──`);
  console.log(`   Relationship Between Scenes: ${ch.relationshipBetweenScenes}`);
  console.log(`   Total Scenes: ${ch.scenes.length}`);
  ch.scenes.forEach(s => {
    console.log(`     * Scene ID: ${s.sceneId} | Interaction: ${s.interactionId} | Date: ${s.date} | Rel: ${s.relationshipToPreviousScene} → ${s.relationshipToNextScene}`);
    console.log(`       Context: ${s.context}`);
    console.log(`       Dialogue: ${s.dialogue.slice(0, 2).join(' | ')}`);
  });
});

// ── Execute GPT-5 mini 3-Chapter Generation with Explicit Scene Boundaries ─────
console.log('\n[2] Generating 3 Test Chapters via GPT-5 mini with hard scene boundaries...');
const storyModel = getModelForTier('story');
const openaiService = getOpenAIService();

const promptSystem = buildStorySystemPrompt();
const promptUser = `Write ONLY the first 3 chapters using the exact grounded scene material below:

${chapterPlan.slice(0, 3).map((ch, idx) => buildChapterSpecificPromptContext(ch, conversationOverview(metadata))).join('\n\n')}

Write 3 distinct chapters (350-500 words each). Return valid JSON with "chapters": [ ... ].`;

function conversationOverview(meta) {
  return {
    participants: meta.participants,
    totalMessages: meta.totalMessages,
    dateRange: `${meta.startDate} to ${meta.endDate}`,
  };
}

try {
  const result = await openaiService.completeStructured({
    model: storyModel,
    tier: 'story',
    systemPrompt: promptSystem,
    userPrompt: promptUser,
    schema: {
      type: 'object',
      properties: {
        chapters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              period: { type: 'string' },
              narrative: { type: 'string' },
              keyStats: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'string' },
                  },
                  required: ['label', 'value'],
                  additionalProperties: false,
                },
              },
              evidenceIds: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['id', 'title', 'period', 'narrative', 'keyStats', 'evidenceIds'],
            additionalProperties: false,
          },
        },
      },
      required: ['chapters'],
      additionalProperties: false,
    },
    schemaName: 'ThreeChapterSceneBoundaryTest',
    maxOutputTokens: 6000,
    temperature: 0.75,
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📖 3-CHAPTER TEST GENERATION OUTPUT:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const generatedChapters = result.chapters || [];
  generatedChapters.forEach((ch, idx) => {
    console.log(`───────────────────────────────────────────────────────────────`);
    console.log(`CHAPTER ${idx + 1}: ${ch.title.toUpperCase()} (${ch.period})`);
    console.log(`───────────────────────────────────────────────────────────────`);
    console.log(ch.narrative);
    console.log();
  });

  // ── AUTOMATED TEST ASSERTIONS ────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 AUTOMATED ACCEPTANCE CRITERIA EVALUATION:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // TEST 1 ASSERTION: Chapter covering Gift & Vinicius must NOT say "flipped from gifts to Vinicius in same breath"
  // and must contain clear scene separation
  const ch1Text = generatedChapters[0]?.narrative || '';
  const test1NoStitching = !ch1Text.includes('flipped from') && !ch1Text.includes('same breath') && !ch1Text.includes('in the same conversation');
  const test1HasTransition = /separate|later|15 minutes|elsewhere|another exchange/i.test(ch1Text);
  console.log(`TEST 1 (Separate Scenes on Same Day: Gift vs Vinicius): ${test1NoStitching ? 'PASS ✅' : 'FAIL ❌'} (Transition: ${test1HasTransition ? 'Yes' : 'No'})`);

  // TEST 2 ASSERTION: Recurring Topic (Cricket in Jan vs April)
  const ch2Text = generatedChapters[1]?.narrative || '';
  const test2PreservesChronology = /january|april|months later|fast forward|later in|resurfaced/i.test(ch2Text) || /separate/i.test(ch2Text);
  console.log(`TEST 2 (Recurring Topic Months Apart: Cricket): ${test2PreservesChronology ? 'PASS ✅' : 'FAIL ❌'}`);

  // TEST 3 ASSERTION: Confirmed Callback (100 Rupee joke)
  const ch3Text = generatedChapters[2]?.narrative || '';
  const test3HasCallback = /callback|remember|months later|resurfaced|brought back/i.test(ch3Text) && ch3Text.includes('100 rupee');
  console.log(`TEST 3 (True Callback across Time: 100 Rupee Broke Joke): ${test3HasCallback ? 'PASS ✅' : 'FAIL ❌'}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🏆 3-TEST SCENE BOUNDARY SUITE COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
} catch (err) {
  console.error('Test execution error:', err);
}
