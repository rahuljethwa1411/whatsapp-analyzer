import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { Groq } from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  const models = ['groq/compound-mini', 'groq/compound', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];
  for (const m of models) {
    try {
      const res = await groq.chat.completions.create({
        model: m,
        messages: [
          { role: 'system', content: 'You are a JSON extractor. Output valid JSON: {"topics": ["food"]}' },
          { role: 'user', content: 'Rahul: Let us eat pizza' }
        ],
        response_format: { type: 'json_object' }
      });
      console.log(`✅ [${m}] ->`, res.choices[0]?.message?.content);
    } catch (e) {
      console.log(`❌ [${m}] ->`, e.message);
    }
  }
}
test();
