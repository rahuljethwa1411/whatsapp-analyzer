import { buildStoryAngles, enforceTenChapters } from '../server/lib/storyGenerator.js';
import { huntAndVerifyReceipts } from '../server/lib/receiptHunter.js';

const messages = [
  { id: 'msg_1', sender: 'Rahul', timestamp: '2024-08-12T17:12:00.000Z', text: "bro we're actually going Goa this time" },
  { id: 'msg_3', sender: 'Kabir', timestamp: '2024-08-12T17:15:00.000Z', text: 'booking tomorrow' },
  { id: 'msg_4', sender: 'Rahul', timestamp: '2024-08-12T17:16:00.000Z', text: 'bro I wanted to tell you something really important but I forgot' },
  { id: 'msg_6', sender: 'Rahul', timestamp: '2024-08-12T19:47:00.000Z', text: 'loooool' },
  { id: 'msg_7', sender: 'Aisha', timestamp: '2024-08-12T19:48:00.000Z', text: 'are you okay?' },
  { id: 'msg_8', sender: 'Rahul', timestamp: '2024-08-15T04:00:00.000Z', text: 'im on my way' },
  { id: 'msg_9', sender: 'Rahul', timestamp: '2024-08-15T04:01:00.000Z', text: '(sent from bed)' },
  { id: 'msg_11', sender: 'Kabir', timestamp: '2024-08-15T05:30:00.000Z', text: 'dramatic re-entry' },
  { id: 'msg_12', sender: 'Aisha', timestamp: '2024-08-15T05:32:00.000Z', text: 'Goa plan has become a personality trait now' },
  { id: 'msg_13', sender: 'Nikhil', timestamp: '2024-08-15T05:34:00.000Z', text: 'same plan next month also?' },
];

const messageIndex = new Map(messages.map(message => [message.id, { ...message, type: 'message' }]));

const intelligence = {
  overview: {
    dominantThemes: ['Goa plan', 'group-chat logistics', 'comic timing'],
    overallTone: 'chaotic planning energy',
    potentialStoryArcs: ['A group chat tries to become a travel plan and immediately exposes its own chaos.'],
    recurringJokes: ['Goa actually happening', 'dramatic re-entry'],
  },
  eras: [],
  characters: [],
  lore: [],
  plotTwists: [],
  patterns: [],
  _evidenceStore: [
    { ...messageIndex.get('msg_1'), messageId: 'msg_1', type: 'plan', importance: 0.93, connection: 'Rahul announces the Goa plan like this one might finally survive the group chat' },
    { ...messageIndex.get('msg_3'), messageId: 'msg_3', type: 'promise', importance: 0.88, connection: 'Kabir turns the plan into a concrete booking commitment' },
    { ...messageIndex.get('msg_4'), messageId: 'msg_4', type: 'vulnerability', importance: 0.82, connection: 'Rahul creates suspense about something important and immediately loses the plot' },
    { ...messageIndex.get('msg_6'), messageId: 'msg_6', type: 'funny', importance: 0.74, connection: 'Rahul reacts with pure group-chat nonsense' },
    { ...messageIndex.get('msg_7'), messageId: 'msg_7', type: 'behavior', importance: 0.78, connection: 'Aisha checks on Rahul after the nonsense escalates' },
    { ...messageIndex.get('msg_8'), messageId: 'msg_8', type: 'event', importance: 0.86, connection: 'Rahul claims he is on the way' },
    { ...messageIndex.get('msg_9'), messageId: 'msg_9', type: 'contradiction', importance: 0.9, connection: 'Rahul immediately undercuts being on the way by revealing he is still in bed' },
    { ...messageIndex.get('msg_11'), messageId: 'msg_11', type: 'memorable', importance: 0.8, connection: 'Kabir labels Rahul arriving as a dramatic re-entry' },
    { ...messageIndex.get('msg_12'), messageId: 'msg_12', type: 'recurring_language', importance: 0.76, connection: 'Aisha turns the recurring Goa plan into group-chat lore' },
    { ...messageIndex.get('msg_13'), messageId: 'msg_13', type: 'callback_candidate', importance: 0.79, connection: 'Nikhil calls back to the recurring cycle of postponing the same plan' },
  ],
  _investigatorResult: {
    patterns: [
      {
        pattern: 'Plans become comedy almost instantly',
        explanation: 'The Goa plan starts serious, then the receipts immediately turn into timing jokes and dramatic commentary.',
        evidence: ['msg_1', 'msg_3', 'msg_8', 'msg_9'],
      },
    ],
    contradictions: [
      {
        claim: 'Rahul is on his way',
        laterBehavior: 'Rahul says the message was sent from bed',
        explanation: 'The archive catches the plan and the reality standing in two different rooms.',
        evidence: ['msg_8', 'msg_9'],
      },
    ],
    callbacks: [],
    lore: [
      {
        name: 'dramatic re-entry',
        origin: 'Kabir describes Rahul showing up like it is an event.',
        howItEvolved: 'The phrase turns ordinary arrival into group-chat lore.',
        evidence: ['msg_11'],
      },
    ],
    overarchingStory: {
      opening: 'A group chat attempts to turn Goa from a recurring myth into an actual plan.',
      development: 'The planning gets real enough for booking talk, then immediately becomes comedy.',
      currentState: 'The receipts leave the chat in travel-plan chaos mode.',
      overallDynamic: 'group-chat planning chaos',
      keyThemes: ['plans', 'comic timing', 'group lore'],
    },
  },
};

const metadata = {
  totalMessages: 11,
  totalParticipants: 4,
  participants: ['Rahul', 'Aisha', 'Kabir', 'Nikhil'],
  durationDays: 3,
};

const summaryStats = {
  peakHour: '10 PM',
  peakDay: 'Thursday',
  peakMonth: 'August',
  longestSilenceDays: 2,
  longestStreakDays: 1,
  mostUsedEmoji: 'none',
  topWords: ['goa', 'booking', 'bro'],
};

const receiptCatalog = huntAndVerifyReceipts(intelligence, messageIndex, 30);
const storyAngles = buildStoryAngles(intelligence, metadata, summaryStats, receiptCatalog);
const story = enforceTenChapters(
  {
    title: 'Representative Story Layer Output',
    subtitle: 'Local story-layer sample from verified extracted evidence.',
    opening: 'This is a local representative output. No Groq, extraction, synthesis, or story API call was made.',
    chapters: [],
    awards: [],
    verdict: {
      title: 'LOCAL STORY CHECK',
      description: 'The generator creates ten evidence-backed angles without inventing new events.',
      badge: 'Story Layer',
    },
    ending: 'Receipts first. Lore second.',
  },
  intelligence,
  receiptCatalog,
  storyAngles
);

console.log(JSON.stringify(story, null, 2));
