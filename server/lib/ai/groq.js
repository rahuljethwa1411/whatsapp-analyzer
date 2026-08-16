import Groq from 'groq-sdk';
import { AIProvider } from './provider.js';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

/**
 * GroqProvider — wraps the Groq SDK.
 * Handles retries, JSON extraction, Zod validation.
 */
export class GroqProvider extends AIProvider {
  constructor() {
    super();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      throw new Error('GROQ_API_KEY is not configured. Set it in server/.env');
    }
    this.groq = new Groq({ apiKey });
    this.defaultModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  /**
   * @param {{ systemPrompt: string, userPrompt: string, schema: import('zod').ZodSchema, model?: string }} options
   */
  async complete({ systemPrompt, userPrompt, schema, model }) {
    const useModel = model || this.defaultModel;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.groq.chat.completions.create({
          model: useModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty response from Groq');

        // Parse JSON
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          // Try to extract JSON from possible markdown wrapping
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[1]);
          } else {
            throw new Error(`Groq returned non-JSON content: ${content.slice(0, 200)}`);
          }
        }

        // Zod validation
        const validated = schema.parse(parsed);
        return validated;

      } catch (err) {
        lastError = err;

        const isRateLimit = err?.status === 429;
        const isRetryable = isRateLimit || err?.message?.includes('timeout') || err?.message?.includes('network');

        if (!isRetryable || attempt === MAX_RETRIES) break;

        const delay = isRateLimit
          ? (parseInt(err?.headers?.['retry-after'] || '5', 10) * 1000)
          : RETRY_DELAY_MS * (attempt + 1);

        console.warn(`[Groq] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err.message);
        await sleep(delay);
      }
    }

    throw lastError;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
