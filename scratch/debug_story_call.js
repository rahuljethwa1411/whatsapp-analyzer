import { getOpenAIService } from '../server/lib/ai/openaiClient.js';
import { buildStorySystemPrompt, buildStoryUserPrompt } from '../server/lib/ai/prompts/storyPrompt.js';
import { STORY_JSON_SCHEMA } from '../server/lib/ai/schemas/index.js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const svc = getOpenAIService();

const systemPrompt = buildStorySystemPrompt();
const userPrompt = buildStoryUserPrompt({
  intelligence: {
    eras: [{ title: 'Early Banter', startAt: '2024-01-01', endAt: '2024-03-01', summary: 'Lots of jokes and memes' }],
    patterns: [{ pattern: '2 AM texting', explanation: 'Sends reels late at night' }],
    _evidenceStore: [
      { messageId: 'msg_1', sender: 'Rahul', text: 'Where is my biryani?', timestamp: '2024-01-01 12:00', type: 'funny' },
      { messageId: 'msg_2', sender: 'iteeca💫', text: 'You never paid for it', timestamp: '2024-01-01 12:05', type: 'funny' }
    ]
  },
  summaryStats: {
    peakHour: '11 PM',
    peakDay: 'Friday',
    peakMonth: 'March',
    longestSilenceDays: 5,
    longestStreakDays: 14,
    mostUsedEmoji: '💀',
    topWords: ['biryani', 'exam', 'sleep', 'reel']
  },
  metadata: {
    participants: ['Rahul', 'iteeca💫'],
    totalMessages: 23979,
    durationDays: 365,
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  },
  formattedReceipts: '',
  storyAngles: []
});

console.log('Sending test story prompt to gpt-5-mini via OpenAIService...');

try {
  const result = await svc.completeStructured({
    model: 'gpt-5-mini',
    tier: 'story',
    systemPrompt,
    userPrompt,
    schema: STORY_JSON_SCHEMA,
    schemaName: 'CompleteStoryResponse',
    maxOutputTokens: 8000
  });

  console.log('LIVE STORY GENERATION SUCCESS!');
  console.log('Story Title:', result.title);
  console.log('Story Subtitle:', result.subtitle);
  console.log('Chapters Count:', result.chapters?.length);
  if (result.chapters?.[0]) {
    console.log('Chapter 1 Title:', result.chapters[0].title);
    console.log('Chapter 1 Narrative Preview:', result.chapters[0].narrative?.slice(0, 100) + '...');
  }
} catch (err) {
  console.error('LIVE STORY GENERATION FAILED:', err);
}
