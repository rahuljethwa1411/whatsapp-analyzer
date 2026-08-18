/**
 * OpenAI Model Configuration & Environment Validation.
 *
 * Enforces exact tiered model architecture:
 *   - Extraction: fast, affordable, structured fact extraction (default: gpt-4o-mini)
 *   - Evidence: global intelligence memory, callbacks, contradictions (default: gpt-4o-mini)
 *   - Story: 10-chapter narrative generation, voice, pacing (default: gpt-5-mini)
 *
 * Validates environment variables at startup without exposing API keys.
 */

export const DEFAULT_CONFIG = {
  OPENAI_EXTRACTION_MODEL: 'gpt-4o-mini',
  OPENAI_EVIDENCE_MODEL: 'gpt-4o-mini',
  OPENAI_STORY_MODEL: 'gpt-5-mini',
  TOP_LEVEL_CHUNK_COUNT: 20,
  MAX_RECOVERY_DEPTH: 4,
  MAX_CONCURRENT_EXTRACTIONS: 5,
  SAFE_EXTRACTION_INPUT_TOKENS: 14000,
  EXTRACTION_MAX_OUTPUT_TOKENS: 2000,
  EVIDENCE_MAX_OUTPUT_TOKENS: 4000,
  STORY_MAX_OUTPUT_TOKENS: 16000,
};

/**
 * Validates all required OpenAI configuration settings.
 *
 * @throws {Error} if required variables are missing or misconfigured
 * @returns {Object} validated configuration
 */
export function validateModelConfig() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey.trim() === '') {
    const errorMsg = 'Model configuration error: OPENAI_API_KEY is not set or is empty in environment.';
    return {
      isValid: false,
      error: errorMsg,
      config: null,
    };
  }

  const extractionModel = process.env.OPENAI_EXTRACTION_MODEL || DEFAULT_CONFIG.OPENAI_EXTRACTION_MODEL;
  const evidenceModel = process.env.OPENAI_EVIDENCE_MODEL || DEFAULT_CONFIG.OPENAI_EVIDENCE_MODEL;
  const storyModel = process.env.OPENAI_STORY_MODEL || DEFAULT_CONFIG.OPENAI_STORY_MODEL;

  if (!extractionModel.trim()) {
    throw new Error('Model configuration error: OPENAI_EXTRACTION_MODEL cannot be empty.');
  }
  if (!evidenceModel.trim()) {
    throw new Error('Model configuration error: OPENAI_EVIDENCE_MODEL cannot be empty.');
  }
  if (!storyModel.trim()) {
    throw new Error('Model configuration error: OPENAI_STORY_MODEL cannot be empty.');
  }

  const topLevelChunkCount = Math.max(
    1,
    parseInt(process.env.TOP_LEVEL_CHUNK_COUNT || String(DEFAULT_CONFIG.TOP_LEVEL_CHUNK_COUNT), 10)
  );

  const maxRecoveryDepth = Math.max(
    1,
    parseInt(process.env.MAX_RECOVERY_DEPTH || String(DEFAULT_CONFIG.MAX_RECOVERY_DEPTH), 10)
  );

  const maxConcurrentExtractions = Math.max(
    1,
    parseInt(process.env.MAX_CONCURRENT_EXTRACTIONS || String(DEFAULT_CONFIG.MAX_CONCURRENT_EXTRACTIONS), 10)
  );

  const safeExtractionInputTokens = Math.max(
    1000,
    parseInt(process.env.SAFE_EXTRACTION_INPUT_TOKENS || String(DEFAULT_CONFIG.SAFE_EXTRACTION_INPUT_TOKENS), 10)
  );

  const extractionMaxOutputTokens = Math.max(
    256,
    parseInt(process.env.EXTRACTION_MAX_OUTPUT_TOKENS || String(DEFAULT_CONFIG.EXTRACTION_MAX_OUTPUT_TOKENS), 10)
  );

  const evidenceMaxOutputTokens = Math.max(
    512,
    parseInt(process.env.EVIDENCE_MAX_OUTPUT_TOKENS || String(DEFAULT_CONFIG.EVIDENCE_MAX_OUTPUT_TOKENS), 10)
  );

  const storyMaxOutputTokens = Math.max(
    512,
    parseInt(process.env.STORY_MAX_OUTPUT_TOKENS || String(DEFAULT_CONFIG.STORY_MAX_OUTPUT_TOKENS), 10)
  );

  const config = {
    apiKeyConfigured: true,
    extractionModel,
    evidenceModel,
    storyModel,
    topLevelChunkCount,
    maxRecoveryDepth,
    maxConcurrentExtractions,
    safeExtractionInputTokens,
    extractionMaxOutputTokens,
    evidenceMaxOutputTokens,
    storyMaxOutputTokens,
  };

  return {
    isValid: true,
    error: null,
    config,
  };
}

/**
 * Resolves the appropriate model name for a given pipeline tier.
 *
 * @param {'extraction'|'evidence'|'story'|'synthesis'} tier
 * @returns {string} Model identifier
 */
export function getModelForTier(tier) {
  switch (tier) {
    case 'extraction':
      return process.env.OPENAI_EXTRACTION_MODEL || DEFAULT_CONFIG.OPENAI_EXTRACTION_MODEL;
    case 'evidence':
    case 'synthesis':
      return process.env.OPENAI_EVIDENCE_MODEL || DEFAULT_CONFIG.OPENAI_EVIDENCE_MODEL;
    case 'story':
      return process.env.OPENAI_STORY_MODEL || DEFAULT_CONFIG.OPENAI_STORY_MODEL;
    default:
      return process.env.OPENAI_EXTRACTION_MODEL || DEFAULT_CONFIG.OPENAI_EXTRACTION_MODEL;
  }
}
