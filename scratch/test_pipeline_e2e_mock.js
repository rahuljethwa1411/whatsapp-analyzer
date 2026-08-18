import { getTokenTelemetry, resetTokenTelemetry } from '../server/lib/ai/openaiClient.js';
import { createChunks } from '../server/lib/chunker.js';
import { buildEvidenceStore, buildMessageIndex } from '../server/lib/evidence.js';
import { enforceTenChapters, buildStoryAngles } from '../server/lib/storyGenerator.js';
import { huntAndVerifyReceipts } from '../server/lib/receiptHunter.js';

console.log('=== TEST 4: Full Pipeline End-to-End Simulation & Telemetry ===');

resetTokenTelemetry();

// Build simulated 23,979 messages dataset
console.log('1. Generating 23,979 conversation messages...');
const allMessages = [];
const baseDate = new Date('2024-01-01T00:00:00.000Z');
const participants = ['Rahul', 'Sam'];

for (let i = 1; i <= 23979; i++) {
  const ts = new Date(baseDate.getTime() + i * 15000).toISOString();
  allMessages.push({
    id: `msg_${i}`,
    timestamp: ts,
    sender: i % 2 === 0 ? 'Rahul' : 'Sam',
    text: i % 100 === 0 ? `Important message ${i} about our mutual friend and the Goa plan!` : `Message ${i}`,
    type: 'message',
  });
}

// 2. Chunk into 20 logical chunks
const logicalChunks = createChunks([], allMessages);
console.log(`2. Created ${logicalChunks.length} logical chunks (expected 20).`);

// 3. Simulate structured extractions from 20 logical chunks
console.log('3. Simulating 20 logical extractions (gpt-4o-mini structured outputs)...');
const simulatedExtractions = logicalChunks.map((chunk, idx) => {
  const sampleMsg = chunk.messages[Math.floor(chunk.messages.length / 2)];
  return {
    period: { start: chunk.startAt, end: chunk.endAt },
    topics: [`topic_in_chunk_${idx + 1}`, 'shared banter', 'weekend plans'],
    recurringThemes: ['banter', 'frequent replies'],
    evidence: [
      {
        messageId: sampleMsg?.id || `msg_${idx * 1000 + 1}`,
        type: idx % 3 === 0 ? 'inside_joke' : (idx % 3 === 1 ? 'turning_point' : 'plan'),
        importance: 0.88,
        connection: `Representative observation from logical chunk ${idx + 1}`,
      },
    ],
  };
});

const messageIndex = buildMessageIndex(allMessages);
const evidenceStore = buildEvidenceStore(simulatedExtractions, messageIndex);
console.log(`4. Deterministic evidence store created with ${evidenceStore.length} verified items.`);

// 4. Build mock intelligence dossier
const mockIntelligence = {
  overview: {
    dominantThemes: ['Trip logistics', 'Running banter', 'Late-night check-ins'],
    overallTone: 'Chaotic & witty friendship',
    potentialStoryArcs: ['The Goa Plan Era', 'The Long Distance Catchup'],
    recurringJokes: ['Biryani debt', 'Missing keys'],
  },
  eras: [
    {
      id: 'era_1',
      title: 'The Inception & First Exchanges',
      startAt: logicalChunks[0].startAt,
      endAt: logicalChunks[5].endAt,
      summary: 'High volume initial conversations',
      dominantTopics: ['College', 'Plans'],
      tone: 'Energetic',
      importance: 0.9,
      evidenceMessageIds: [logicalChunks[0].messages[0].id],
    },
  ],
  characters: participants.map((p) => ({
    participant: p,
    title: 'The Planner',
    description: 'Frequently initiates topics and tracks logistics.',
    observableTraits: ['Direct', 'Humorous'],
    confidence: 0.95,
    evidenceMessageIds: [],
  })),
  patterns: [
    {
      id: 'pat_1',
      title: 'The Double-Text Check-in',
      description: 'Follows up within 2 hours if no response.',
      frequency: 12,
      importance: 0.85,
      evidenceMessageIds: [],
    },
  ],
  lore: [
    {
      id: 'lore_1',
      title: 'The Goa Reservation Mystery',
      description: 'A 6-month saga of booking and cancelling tickets.',
      date: '2024-03-01',
      participants: ['Rahul', 'Sam'],
      funnyScore: 0.95,
      importance: 0.9,
      evidenceMessageIds: [],
    },
  ],
  plotTwists: [],
  _evidenceStore: evidenceStore,
};

// 5. Generate complete 10-chapter story using the story engine
console.log('5. Generating 10-chapter story through StoryGenerator...');
const metadata = {
  totalMessages: 23979,
  totalParticipants: 2,
  participants,
  durationDays: 120,
};

const summaryStats = {
  peakHour: '10 PM',
  peakDay: 'Friday',
  peakMonth: 'March',
  longestSilenceDays: 4,
  longestStreakDays: 45,
  mostUsedEmoji: '💀',
  topWords: ['bro', 'trip', 'reach', 'tomorrow'],
};

const receiptCatalog = huntAndVerifyReceipts(mockIntelligence, messageIndex, 30);
const storyAngles = buildStoryAngles(mockIntelligence, metadata, summaryStats, receiptCatalog);

const mockRawStory = {
  title: 'The Verified WhatsApp Archive',
  subtitle: 'A 23,979 message documentary investigation',
  opening: 'Two participants engage in prolonged conversational bickering over 120 days.',
  chapters: storyAngles.slice(0, 8).map((angle, i) => ({
    id: `chap_${i + 1}`,
    title: angle.title,
    period: angle.period,
    narrative: `Evidence-grounded chapter ${i + 1} exploring ${angle.label}.`,
    keyStats: angle.keyStats || [],
    evidenceMessageIds: angle.evidenceMessageIds || [],
  })),
};

const normalizedStory = enforceTenChapters(mockRawStory, mockIntelligence, receiptCatalog, storyAngles);

console.log(`6. Story generated: "${normalizedStory.title}"`);
console.log(`   Chapters generated: ${normalizedStory.chapters.length}`);
console.log(`   Verified receipts attached: ${receiptCatalog.receipts.length}`);

// Verify 10 distinct chapters
if (normalizedStory.chapters.length !== 10) {
  throw new Error(`Expected exactly 10 chapters, got ${normalizedStory.chapters.length}`);
}

// 6. Check Token & Cost Telemetry
const telemetry = getTokenTelemetry();
console.log('\n==================================================');
console.log('PIPELINE TELEMETRY CHECK:');
console.log('==================================================');
console.log('Provider:          ', telemetry.provider);
console.log('Extraction Model:  ', telemetry.extractionModel);
console.log('Evidence Model:    ', telemetry.evidenceModel);
console.log('Story Model:       ', telemetry.storyModel);
console.log('Cost Estimates:    ', telemetry.costs);
console.log('==================================================');

console.log('\n✓ End-to-end multi-tier pipeline test completed successfully.');
