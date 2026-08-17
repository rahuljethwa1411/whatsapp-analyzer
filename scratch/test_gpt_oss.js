import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  const systemPrompt = `You are an intelligence analysis engine.
Return ONLY valid JSON matching this schema:
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
[msg_2] [2024-01-01 10:05] Aisha: Yes booked tickets!`;

  try {
    const res = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    console.log('=== CHOICES ===');
    console.log(JSON.stringify(res.choices[0], null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
