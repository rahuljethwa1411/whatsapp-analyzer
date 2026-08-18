import { ChunkEvidenceSchema, RelationshipInvestigatorSchema, StorySchema } from '../server/lib/ai/schemas/index.js';
import { buildMessageIndex, validateInvestigatorRefs, buildEvidenceStore } from '../server/lib/evidence.js';
import { mergeExtractionResults } from '../server/lib/intelligence.js';

console.log('=== TEST 3: Structured Schema Validation & Deterministic Evidence Processing ===');

// Test 1: Chunk Evidence Schema Validation
const sampleExtraction = {
  period: { start: '2024-01-01', end: '2024-01-02' },
  topics: ['weekend trip', 'inside joke about biryani', 'work project'],
  recurringThemes: ['banter', 'spontaneous check-ins'],
  evidence: [
    {
      messageId: 'msg_10',
      type: 'inside_joke',
      importance: 0.95,
      connection: 'recurring reference to unpaid biryani debt from 6 months ago',
    },
    {
      messageId: 'msg_25',
      type: 'turning_point',
      importance: 0.85,
      connection: 'agreed on collaborative project kickoff date',
    },
  ],
};

const validatedExtraction = ChunkEvidenceSchema.safeParse(sampleExtraction);
console.log('ChunkEvidenceSchema valid:', validatedExtraction.success);
if (!validatedExtraction.success) {
  throw new Error('ChunkEvidenceSchema failed validation');
}

// Test 2: Message Indexing & Deterministic Evidence Store
const mockMessages = [
  { id: 'msg_10', timestamp: '2024-01-01T12:00:00Z', sender: 'Rahul', text: 'Where is my biryani??', type: 'message' },
  { id: 'msg_25', timestamp: '2024-01-02T15:30:00Z', sender: 'Alex', text: 'Let’s start the project tomorrow', type: 'message' },
  { id: 'msg_99', timestamp: '2024-01-03T18:00:00Z', sender: 'Rahul', text: 'Sounds good', type: 'message' },
];

const messageIndex = buildMessageIndex(mockMessages);
const extractionsList = [sampleExtraction];

const evidenceStore = buildEvidenceStore(extractionsList, messageIndex);
console.log(`Evidence store built with ${evidenceStore.length} verified items.`);
console.log(`Top item text resolved: "${evidenceStore[0]?.text}"`);
if (evidenceStore[0]?.text !== 'Where is my biryani??') {
  throw new Error('Evidence store failed to resolve exact message text');
}

// Test 3: Subchunk Merging
const subExtractionA = {
  period: { start: '2024-01-01', end: '2024-01-01' },
  topics: ['topic 1'],
  recurringThemes: ['theme 1'],
  evidence: [{ messageId: 'msg_10', type: 'inside_joke', importance: 0.9, connection: 'earlier joke' }],
};

const subExtractionB = {
  period: { start: '2024-01-02', end: '2024-01-02' },
  topics: ['topic 2'],
  recurringThemes: ['theme 2'],
  evidence: [{ messageId: 'msg_25', type: 'plan', importance: 0.85, connection: 'plan made' }],
};

const merged = mergeExtractionResults({ id: 'chunk_1', startAt: '2024-01-01', endAt: '2024-01-02' }, [subExtractionA, subExtractionB]);
console.log(`Merged subchunks: ${merged.evidence.length} evidence items, ${merged.topics.length} topics.`);

// Test 4: Story Schema Validation
const sampleStory = {
  title: 'The Great Biryani Debt Chronicles',
  subtitle: 'A Documented Study of Unfulfilled Food Promises',
  opening: 'Two participants engage in prolonged conversational bickering.',
  chapters: Array.from({ length: 10 }, (_, i) => ({
    id: `chap_${i + 1}`,
    title: `Chapter ${i + 1}: The Narrative Unfolds`,
    period: '2024-01-01 -> 2024-01-02',
    narrative: `Observational story chapter ${i + 1} detailing evidence and receipts without fabricated drama.`,
    keyStats: [{ label: 'Significance', value: 'High' }],
    evidenceMessageIds: ['msg_10'],
  })),
  awards: [
    {
      id: 'award_1',
      title: 'Chief Biryani Evader',
      recipient: 'Alex',
      reason: 'Skillfully deflected all culinary obligations for 180 consecutive days.',
      emoji: '🍛',
      evidenceMessageIds: ['msg_10'],
    },
  ],
  verdict: {
    title: 'Certified Food Debt Dynamic',
    description: 'A genuine, hilarious ongoing conversation backed by verifiable receipts.',
    badge: 'Legendary Lore',
  },
  ending: 'The biryani remains unpaid to this day.',
};

const validatedStory = StorySchema.safeParse(sampleStory);
console.log('StorySchema 10-chapter valid:', validatedStory.success);
if (!validatedStory.success) {
  console.error(validatedStory.error);
  throw new Error('StorySchema failed validation');
}

console.log('✓ All structured schema and deterministic tests passed successfully.');
