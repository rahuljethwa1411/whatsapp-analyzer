/**
 * AIProvider — abstract interface for all AI completions in Phase 3.
 * The rest of the application calls this interface.
 * Swap GroqProvider for any other provider by changing the factory only.
 */

/**
 * @typedef {Object} CompletionOptions
 * @property {string} systemPrompt
 * @property {string} userPrompt
 * @property {import('zod').ZodSchema} schema  — expected JSON shape
 * @property {number} [maxRetries]
 * @property {string} [model]        — override default model for this call
 */

export class AIProvider {
  /**
   * @param {CompletionOptions} options
   * @returns {Promise<any>}          — validated, parsed object
   */
  // eslint-disable-next-line no-unused-vars
  async complete(_options) {
    throw new Error('AIProvider.complete() must be implemented by a subclass.');
  }
}
