import 'dotenv/config';
import { GroqProvider } from '../server/lib/ai/groq.js';
import { ChunkEvidenceSchema, StorySchema } from '../server/lib/ai/schemas/index.js';
import { normalizeExtractionResult } from '../server/lib/evidence.js';
import { buildChunkExtractionSystemPrompt } from '../server/lib/ai/prompts/chunkExtraction.js';

async function run() {
  const provider = new GroqProvider();
  const groq = provider.groq;

  for (const m of ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.6-27b']) {
    try {
      console.log(`\nTesting raw response on ${m}...`);
      const res = await groq.chat.completions.create({
        model: m,
        messages: [
          { role: 'system', content: buildChunkExtractionSystemPrompt() + '\nReturn JSON matching schema: {"period":{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"},"topics":["sports"],"recurringThemes":["cricket"],"evidence":[]}' },
          { role: 'user', content: '[msg_1] [2024-01-01 10:00:00] Rahul: hello bro are you coming to play cricket?\n[msg_2] [2024-01-01 10:05:00] Aisha: yes definitely' }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      });
      console.log(`✅ ${m} returned:`, res.choices[0]?.message?.content);
    } catch (e) {
      console.error(`❌ ${m} error:`, e.message);
    }
  }
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
