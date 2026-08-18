import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
const g = new Groq({ apiKey });

const systemPrompt = `You are extracting conversation evidence. Return valid JSON only with keys: period, topics, recurringThemes, evidence.`;
const userPrompt = `CHUNK 1 OF 1
Messages:
[msg_1] [2024-01-01 10:00] Alice: Hey, are we still meeting for coffee?
[msg_2] [2024-01-01 10:01] Bob: Yes! 4pm at the usual cafe.
[msg_3] [2024-01-01 10:05] Alice: Perfect, don't be late this time haha

Output JSON matching:
{
  "period": { "start": "2024-01-01 10:00", "end": "2024-01-01 10:05" },
  "topics": ["coffee meetup"],
  "recurringThemes": ["banter"],
  "evidence": [
    {
      "messageId": "msg_1",
      "type": "plan",
      "importance": 0.8,
      "connection": "planning a coffee meetup"
    }
  ]
}`;

try {
  const t0 = Date.now();
  const res = await g.chat.completions.create({
    model: 'groq/compound-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 800
  });
  console.log(`✅ [groq/compound-mini] took ${Date.now() - t0}ms`);
  console.log(res.choices[0].message.content);
} catch (e) {
  console.log(`❌ Error:`, e);
}
