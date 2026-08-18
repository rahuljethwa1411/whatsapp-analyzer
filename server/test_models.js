import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
const g = new Groq({ apiKey });

const models = [
  'openai/gpt-oss-20b',
  'groq/compound-mini',
  'openai/gpt-oss-120b',
  'groq/compound',
  'qwen/qwen3.6-27b'
];

for (const m of models) {
  try {
    const t0 = Date.now();
    const res = await g.chat.completions.create({
      model: m,
      messages: [{ role: 'user', content: 'Output JSON: {"test": true, "msg": "ok"}' }],
      response_format: { type: 'json_object' },
      max_tokens: 100
    });
    console.log(`✅ [${m}] (${Date.now() - t0}ms):`, res.choices[0].message.content);
  } catch (e) {
    console.log(`❌ [${m}]:`, e.message);
  }
}
