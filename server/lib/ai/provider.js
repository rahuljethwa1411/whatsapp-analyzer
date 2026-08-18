/**
 * AIProvider — abstract interface for AI completions.
 * Delegates to OpenAI Service.
 */

import { getOpenAIService } from './openaiClient.js';

export class AIProvider {
  constructor() {
    this.service = getOpenAIService();
  }

  async complete(options) {
    return this.service.complete(options);
  }
}
