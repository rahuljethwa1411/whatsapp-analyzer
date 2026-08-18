import assert from 'assert';
import { buildMessageIndex, buildEvidenceStore } from '../lib/evidence.js';
import { buildVerifiedConversationMemory } from '../lib/evidenceIntelligence.js';
import { detectConversationEras } from '../lib/eraDetector.js';
import { buildStoryMemory } from '../lib/storyMemory.js';
import { buildChapterPlan, buildChapterSpecificPromptContext } from '../lib/storyArchitecture.js';
import { getOpenAIService } from '../lib/ai/openaiClient.js';
import { buildStorySystemPrompt, buildStoryUserPrompt } from '../lib/ai/prompts/storyPrompt.js';
import { getModelForTier } from '../lib/ai/modelConfig.js';
import { STORY_JSON_SCHEMA } from '../lib/ai/schemas/index.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 5-CHUNK CONTEXT & QUALITY AUDIT (TEST SCENARIOS A - J)');
console.log('═══════════════════════════════════════════════════════════════\n');

// ─── 5-CHUNK SOURCE DATASET (Covering Scenarios A through J) ───────────────────
const sourceMessages = [
  // CHUNK 1 (Sep 2025): Scenarios A (Distinct subjects), D (Early banter)
  { id: 'm101', sender: 'iteeca', timestamp: '2025-09-04T14:10:00Z', text: 'This bitch ass', type: 'message' },
  { id: 'm102', sender: 'Rahul',  timestamp: '2025-09-04T14:11:00Z', text: 'save it or ghost will haunt you tonight', type: 'message' },
  { id: 'm103', sender: 'iteeca', timestamp: '2025-09-04T14:12:00Z', text: 'Nigga😭', type: 'message' },

  // Sep 05 (Unrelated logistics - distinct from Sep 04)
  { id: 'm104', sender: 'iteeca', timestamp: '2025-09-05T11:00:00Z', text: 'Ranchi kab aana hai tera?', type: 'message' },
  { id: 'm105', sender: 'Rahul',  timestamp: '2025-09-05T11:02:00Z', text: 'Next week train tickets book kar rha hu', type: 'message' },
  { id: 'm106', sender: 'iteeca', timestamp: '2025-09-05T11:03:00Z', text: 'Confirm karke bata dena station aa jaungi', type: 'message' },

  // CHUNK 2 (Oct 2025): Scenarios H (28-day gap), D (Flirting), C (100-rupee joke origin), E (Gifts)
  { id: 'm201', sender: 'Rahul',  timestamp: '2025-10-02T19:20:00Z', text: 'sorry yaar', type: 'message' },
  { id: 'm202', sender: 'Rahul',  timestamp: '2025-10-02T19:21:00Z', text: 'khush shaanti', type: 'message' },
  { id: 'm203', sender: 'iteeca', timestamp: '2025-10-02T19:22:00Z', text: 'Good', type: 'message' },
  { id: 'm204', sender: 'Rahul',  timestamp: '2025-10-02T19:23:00Z', text: 'ab chumma do', type: 'message' },
  { id: 'm205', sender: 'iteeca', timestamp: '2025-10-02T19:24:00Z', text: 'Loveyou2', type: 'message' },
  { id: 'm206', sender: 'Rahul',  timestamp: '2025-10-02T19:25:00Z', text: '?', type: 'message' },
  { id: 'm207', sender: 'Rahul',  timestamp: '2025-10-02T19:26:00Z', text: 'chumma maanga', type: 'message' },
  { id: 'm208', sender: 'iteeca', timestamp: '2025-10-02T19:27:00Z', text: '😭😭😭😭', type: 'message' },

  // Oct 09: Gift logistics (Scenario E) + Vinicius leak (Scenario B origin)
  { id: 'm209', sender: 'Rahul',  timestamp: '2025-10-09T16:00:00Z', text: 'itne pyaar se diya yaar', type: 'message' },
  { id: 'm210', sender: 'iteeca', timestamp: '2025-10-09T16:02:00Z', text: 'Arey kr lungi bhaiz bhejungi tujhe krke', type: 'message' },
  { id: 'm211', sender: 'Rahul',  timestamp: '2025-10-09T16:15:00Z', text: 'BHAIII do u remember vinicius jr from real madrid', type: 'message' },
  { id: 'm212', sender: 'iteeca', timestamp: '2025-10-09T16:16:00Z', text: 'The black guy? Hnn', type: 'message' },
  { id: 'm213', sender: 'Rahul',  timestamp: '2025-10-09T16:17:00Z', text: 'uski private chats leak hui hai', type: 'message' },
  { id: 'm214', sender: 'iteeca', timestamp: '2025-10-09T16:18:00Z', text: '😭😭😭😭😐 Ayooooo', type: 'message' },

  // Oct 15: 100-Rupee Broke Joke (Scenario C origin)
  { id: 'm215', sender: 'Rahul',  timestamp: '2025-10-15T21:00:00Z', text: 'Can you order the dessert?', type: 'message' },
  { id: 'm216', sender: 'iteeca', timestamp: '2025-10-15T21:01:00Z', text: 'Saale 100 rupee bhi nahi hai jeb mein', type: 'message' },
  { id: 'm217', sender: 'Rahul',  timestamp: '2025-10-15T21:02:00Z', text: 'Ambani bank bankrupt ho gaya kya', type: 'message' },

  // CHUNK 3 (Nov 2025): Scenario I (Vulnerability / 4 AM depression), G (Sports tease origin), J (Reel joke)
  { id: 'm301', sender: 'Rahul',  timestamp: '2025-11-02T17:00:00Z', text: 'Match dekh tu apna', type: 'message' },
  { id: 'm302', sender: 'Rahul',  timestamp: '2025-11-02T17:01:00Z', text: 'https://instagram.com/reel/123 orgasm', type: 'message' },
  { id: 'm303', sender: 'iteeca', timestamp: '2025-11-02T17:03:00Z', text: 'Nice', type: 'message' },
  { id: 'm304', sender: 'Rahul',  timestamp: '2025-11-02T17:04:00Z', text: 'wtf is nice', type: 'message' },
  { id: 'm305', sender: 'iteeca', timestamp: '2025-11-02T17:05:00Z', text: 'Aur kya bolu', type: 'message' },

  // Nov 11: Real vulnerability (Scenario I)
  { id: 'm306', sender: 'iteeca', timestamp: '2025-11-11T04:00:00Z', text: 'Uske baad 4baje aayi', type: 'message' },
  { id: 'm307', sender: 'Rahul',  timestamp: '2025-11-11T04:02:00Z', text: 'tera sahi hai', type: 'message' },
  { id: 'm308', sender: 'iteeca', timestamp: '2025-11-11T04:03:00Z', text: 'Fir abhi naha kar nikli', type: 'message' },
  { id: 'm309', sender: 'Rahul',  timestamp: '2025-11-11T04:05:00Z', text: 'ab kya karogi', type: 'message' },

  // CHUNK 4 (Dec 2025 - Jan 2026): Scenario F (Missed calls), G (Cricket match resurfacing), I (Apology)
  { id: 'm401', sender: 'Rahul',  timestamp: '2025-12-13T19:30:00Z', text: 'choro ab direct aapke birthday pe karunga', type: 'message' },
  { id: 'm402', sender: 'Rahul',  timestamp: '2025-12-13T19:31:00Z', text: 'i hope 23 ke baad samjh aa jaaye aapko', type: 'message' },
  { id: 'm403', sender: 'Rahul',  timestamp: '2025-12-13T19:32:00Z', text: 'bye jaaneman😘', type: 'message' },
  { id: 'm404', sender: 'iteeca', timestamp: '2025-12-13T19:33:00Z', text: 'Good', type: 'message' },

  // Jan 20: Apology (Scenario I)
  { id: 'm405', sender: 'Rahul',  timestamp: '2026-01-20T02:15:00Z', text: 'I am really sorry about how I reacted yesterday. I value you a lot.', type: 'message' },
  { id: 'm406', sender: 'iteeca', timestamp: '2026-01-20T02:18:00Z', text: 'It means a lot that you said that. Thank you.', type: 'message' },

  // Jan 25: Cricket discussion resurfaces (Scenario G)
  { id: 'm407', sender: 'iteeca', timestamp: '2026-01-25T18:00:00Z', text: 'Abhishek Sharma 68 in 20 balls bro! I think yuvi still tops', type: 'message' },
  { id: 'm408', sender: 'Rahul',  timestamp: '2026-01-25T18:02:00Z', text: '12 me tha yuvi ka', type: 'message' },
  { id: 'm409', sender: 'iteeca', timestamp: '2026-01-25T18:03:00Z', text: '13 or 14 balls ig', type: 'message' },
  { id: 'm410', sender: 'Rahul',  timestamp: '2026-01-25T18:04:00Z', text: 'kya kirket fan banegi tu', type: 'message' },

  // CHUNK 5 (Feb 2026): Scenario C (Explicit 100-rupee callback), B (Vinicius match return), J (Birthday roast)
  { id: 'm501', sender: 'Rahul',  timestamp: '2026-02-14T20:00:00Z', text: 'Concert tickets lene ka plan hai kya?', type: 'message' },
  { id: 'm502', sender: 'iteeca', timestamp: '2026-02-14T20:02:00Z', text: 'Remember when I said 100 rupee bhi nahi hai jeb mein?', type: 'message' },
  { id: 'm503', sender: 'iteeca', timestamp: '2026-02-14T20:03:00Z', text: 'Ambani bank is still bankrupt 😂', type: 'message' },

  // Feb 18: Vinicius topic recurs (Scenario B)
  { id: 'm504', sender: 'Rahul',  timestamp: '2026-02-18T22:30:00Z', text: 'Vinicius scored a brace in UCL today', type: 'message' },
  { id: 'm505', sender: 'iteeca', timestamp: '2026-02-18T22:32:00Z', text: 'Still remember the leaked chat drama lol', type: 'message' },

  // Feb 21: Birthday roast & warmth
  { id: 'm506', sender: 'Rahul',  timestamp: '2026-02-21T00:01:00Z', text: 'kitni tareef sunegi bhai pet nahi bharta kya tera hadd hai', type: 'message' },
  { id: 'm507', sender: 'iteeca', timestamp: '2026-02-21T00:05:00Z', text: '😭😭😭 Genuinely I don’t think I am. But sure Thanks yaar', type: 'message' },
  { id: 'm508', sender: 'Rahul',  timestamp: '2026-02-21T00:08:00Z', text: 'mai hi pagal hu u da real art 🤪', type: 'message' },
];

const messageIndex = buildMessageIndex(sourceMessages);

const rawExtractions = [
  { evidence: [{ messageId: 'm101', type: 'funny', importance: 0.88, connection: 'Ghost and bitch ass opening roast' }] },
  { evidence: [{ messageId: 'm104', type: 'plan', importance: 0.82, connection: 'Ranchi train tickets planning' }] },
  { evidence: [{ messageId: 'm204', type: 'affection', importance: 0.90, connection: 'ab chumma do banter after 28 days' }] },
  { evidence: [{ messageId: 'm209', type: 'gift', importance: 0.84, connection: 'itne pyaar se diya yaar gift logistics' }] },
  { evidence: [{ messageId: 'm211', type: 'gossip', importance: 0.86, connection: 'Vinicius leaked chat gossip' }] },
  { evidence: [{ messageId: 'm216', type: 'funny', importance: 0.92, connection: 'Origin: 100 rupee bhi nahi hai jeb mein & Ambani bank' }] },
  { evidence: [{ messageId: 'm301', type: 'funny', importance: 0.78, connection: 'SRK birthday & reel reaction "wtf is nice"' }] },
  { evidence: [{ messageId: 'm306', type: 'vulnerability', importance: 0.95, connection: '4 AM depression wave and domestic reset' }] },
  { evidence: [{ messageId: 'm401', type: 'conflict', importance: 0.86, connection: 'Missed calls frustration and 23rd birthday jab' }] },
  { evidence: [{ messageId: 'm405', type: 'apology', importance: 0.96, connection: 'Rahul sincere apology and value acknowledgment' }] },
  { evidence: [{ messageId: 'm407', type: 'sports', importance: 0.84, connection: 'Abhishek Sharma cricket match discussion' }] },
  { evidence: [{ messageId: 'm502', type: 'callback_candidate', importance: 0.96, connection: 'Explicit callback to 100 rupee joke 4 months later' }] },
  { evidence: [{ messageId: 'm504', type: 'recurring_topic', importance: 0.80, connection: 'Vinicius Real Madrid topic resurfaces' }] },
  { evidence: [{ messageId: 'm506', type: 'affection', importance: 0.92, connection: 'Birthday roast and genuine gratitude' }] },
];

const evidenceStore = buildEvidenceStore(rawExtractions, messageIndex, sourceMessages);

const metadata = {
  totalMessages: sourceMessages.length,
  totalParticipants: 2,
  participants: ['Rahul', 'iteeca'],
  durationDays: 170,
  startDate: '2025-09-04',
  endDate: '2026-02-21',
};

const summaryStats = {
  peakHour: '12 AM',
  peakDay: 'Friday',
  peakMonth: 'October 2025',
  longestSilenceDays: 28,
  longestStreakDays: 45,
  mostUsedEmoji: '😭',
  topWords: ['yaar', 'bhai', 'bro'],
};

// ── Step 1: Evidence Intelligence ──────────────────────────────────────────────
const conversationMemory = buildVerifiedConversationMemory({
  evidenceStore,
  rawInvestigatorResult: {
    patterns: [
      { pattern: 'Playful escalations with supernatural threats and absurd consequences', evidence: ['m101', 'm204'] },
      { pattern: 'Financial self-deprecation as an excuse for outings and concert tickets', evidence: ['m216', 'm502'] },
    ],
    callbacks: [
      {
        earlier: { messageId: 'm216' },
        later: { messageId: 'm502' },
        connection: 'Explicit callback: "Remember when I said 100 rupee..." — directly resurrecting the Oct joke in Feb',
        confidence: 0.98,
      },
    ],
    contradictions: [],
  },
  metadata,
  summaryStats,
});

// ── Step 2: Era Detection ──────────────────────────────────────────────────────
const { eras, eraTransitions, telemetry: eraTelemetry } = detectConversationEras(
  conversationMemory.verifiedEvents || [],
  {},
  metadata
);

console.log(`[1] Detected Eras: ${eras.length} eras`);
eras.forEach((e, i) => console.log(`    Era ${i + 1}: [${e.eraId}] "${e.title}" (${e.startDate} → ${e.endDate})`));

// ── Step 3: Story Memory ───────────────────────────────────────────────────────
const storyMemory = buildStoryMemory({
  evidenceStore,
  conversationMemory,
  metadata,
  summaryStats,
});

console.log(`\n[2] Story Memory Assembled:`);
console.log(`    High-Value Interactions: ${storyMemory.highValueInteractions.length}`);
console.log(`    Confirmed Callbacks:     ${storyMemory.confirmedCallbacks.length}`);
console.log(`    Timeline Events:         ${storyMemory.timeline.length}`);
console.log(`    Recurring Patterns:      ${storyMemory.recurringPatterns.length}`);

// ── Step 4: Era-Aware Chapter Planning ─────────────────────────────────────────
const { chapters: chapterPlan, telemetry: planTelemetry } = buildChapterPlan(storyMemory);

console.log(`\n[3] Chapter Plan Built (Showing first 3 test chapters):`);
chapterPlan.slice(0, 3).forEach((ch, i) => {
  console.log(`    Chapter ${i + 1} [${ch.chapterType}]: "${ch.title}" (${ch.timeRange})`);
  console.log(`      Central Idea: ${ch.centralIdea}`);
  console.log(`      Evidence IDs: ${ch.evidenceIds.join(', ')}`);
});

// ── Step 5: Test Execution — Generate 3 Test Chapters via GPT-5 mini ───────────
console.log('\n[4] Generating 3 Test Chapters via Story Model...');
const storyModel = getModelForTier('story');
const openaiService = getOpenAIService();

const promptSystem = buildStorySystemPrompt();
const promptUser = `Write ONLY the first 3 chapters of the 10-chapter story following the plan below:

CHAPTER PLAN SCENARIOS:
${chapterPlan.slice(0, 3).map((ch, idx) => buildChapterSpecificPromptContext(ch, idx + 1, storyMemory, 'Rahul and iteeca')).join('\n\n')}

Write 3 distinct chapters (350-500 words each). Return valid JSON with "chapters": [ ... ] matching StorySchema.`;

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
    schemaName: 'ThreeChapterAuditTest',
    maxOutputTokens: 6000,
    temperature: 0.75,
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📖 GENERATED TEST CHAPTERS OUTPUT:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  (result.chapters || []).forEach((ch, idx) => {
    console.log(`───────────────────────────────────────────────────────────────`);
    console.log(`CHAPTER ${idx + 1}: ${ch.title.toUpperCase()} (${ch.period})`);
    console.log(`───────────────────────────────────────────────────────────────`);
    console.log(ch.narrative);
    console.log(`\nKey Stats:`, JSON.stringify(ch.keyStats));
    console.log(`Evidence IDs:`, ch.evidenceIds.join(', '));
    console.log();
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ AUDIT RUN FINISHED SUCCESSFULLY.');
  console.log('═══════════════════════════════════════════════════════════════');
} catch (err) {
  console.error('Test generation failed:', err.message);
}
