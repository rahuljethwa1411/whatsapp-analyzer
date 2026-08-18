/**
 * Legacy Adapter for groq.js imports -> re-exports from openaiClient.js
 */

export * from './openaiClient.js';
export { OpenAIService as GroqProvider } from './openaiClient.js';
