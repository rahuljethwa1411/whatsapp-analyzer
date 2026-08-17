import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { Groq } from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function testExtraction() {
  const systemPrompt = `You are a precise data extraction engine. Return ONLY valid JSON matching this schema:
{
  "period": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },
  "topics": ["string"],
  "recurringThemes": ["string"],
  "evidence": [
    {
      "messageId": "string",
      "type": "string",
      "connection": "string",
      "importance": 0.8
    }
  ]
}`;

  const userPrompt = `Extract from:
[msg_1] [2024-01-01 10:00] Rahul: Are we going to Delhi this weekend?
[msg_2] [2024-01-01 10:05] Aisha: Yes booked tickets for Saturday morning!`;

  const start = Date.now();
  const res = await groq.chat.completions.create({
    model: 'groq/compound-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 1500
  });

  console.log(`⚡ Extraction completed in ${Date.now() - start}ms:`);
  console.log(res.choices[0]?.message?.content);
}

testExtraction();
