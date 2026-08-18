import crypto from 'crypto';

/**
 * Multi-Tier Pipeline Cache.
 *
 * Deterministic caching of extraction, intelligence memory, and story results.
 * Cache keys are derived from content hashes, prompt versions, schema versions, and model IDs.
 *
 * Invalidation happens automatically if any message, model, or schema changes.
 * Extraction cache is not invalidated when the story prompt changes.
 */

const EXTRACTION_SCHEMA_VERSION = 'v4_openai_structured_evidence';
const EVIDENCE_SCHEMA_VERSION = 'v4_openai_intelligence_memory';
const STORY_SCHEMA_VERSION = 'v4_openai_story_v2';

const extractionCache = new Map();
const intelligenceMemoryCache = new Map();
const storyCache = new Map();

// ─── Extraction Cache ─────────────────────────────────────────────────────────

export function computeChunkCacheKey(chunk, model = '') {
  const hash = crypto.createHash('sha256');
  hash.update(String(chunk?.id || ''));
  hash.update('|');
  hash.update(String(model || ''));
  hash.update('|');
  hash.update(EXTRACTION_SCHEMA_VERSION);
  hash.update('|');

  const messages = Array.isArray(chunk?.messages) ? chunk.messages : [];
  for (const m of messages) {
    hash.update(`${m.id || ''}:${m.sender || ''}:${m.text || ''}\n`);
  }

  return hash.digest('hex');
}

export function getCachedExtraction(chunk, model = '') {
  if (process.env.DISABLE_EXTRACTION_CACHE === '1') return null;
  const key = computeChunkCacheKey(chunk, model);
  return extractionCache.get(key) || null;
}

export function setCachedExtraction(chunk, model = '', extraction) {
  if (process.env.DISABLE_EXTRACTION_CACHE === '1' || !extraction) return;
  const key = computeChunkCacheKey(chunk, model);
  extractionCache.set(key, extraction);
}

// ─── Intelligence Memory Cache ────────────────────────────────────────────────

export function computeIntelligenceMemoryCacheKey(extractions, metadata, model = '') {
  const hash = crypto.createHash('sha256');
  hash.update(String(model || ''));
  hash.update('|');
  hash.update(EVIDENCE_SCHEMA_VERSION);
  hash.update('|');
  hash.update(String(metadata?.totalMessages || 0));
  hash.update('|');
  hash.update(Array.isArray(metadata?.participants) ? metadata.participants.join(',') : '');
  hash.update('|');

  for (const ext of extractions || []) {
    hash.update(JSON.stringify(ext.period || {}));
    for (const ev of ext.evidence || []) {
      hash.update(`${ev.messageId}:${ev.type}:${ev.importance}\n`);
    }
  }

  return hash.digest('hex');
}

export function getCachedIntelligenceMemory(extractions, metadata, model = '') {
  if (process.env.DISABLE_EXTRACTION_CACHE === '1') return null;
  const key = computeIntelligenceMemoryCacheKey(extractions, metadata, model);
  return intelligenceMemoryCache.get(key) || null;
}

export function setCachedIntelligenceMemory(extractions, metadata, model = '', memory) {
  if (process.env.DISABLE_EXTRACTION_CACHE === '1' || !memory) return;
  const key = computeIntelligenceMemoryCacheKey(extractions, metadata, model);
  intelligenceMemoryCache.set(key, memory);
}

// ─── Story Cache ──────────────────────────────────────────────────────────────

export function computeStoryCacheKey(intelligence, metadata, model = '') {
  const hash = crypto.createHash('sha256');
  hash.update(String(model || ''));
  hash.update('|');
  hash.update(STORY_SCHEMA_VERSION);
  hash.update('|');
  hash.update(JSON.stringify(intelligence?.overview || {}));
  hash.update('|');
  hash.update(String(metadata?.totalMessages || 0));

  return hash.digest('hex');
}

export function getCachedStory(intelligence, metadata, model = '') {
  if (process.env.ENABLE_STORY_CACHE !== '1') return null; // Story cache disabled by default for fresh creative runs
  const key = computeStoryCacheKey(intelligence, metadata, model);
  return storyCache.get(key) || null;
}

export function setCachedStory(intelligence, metadata, model = '', story) {
  if (process.env.ENABLE_STORY_CACHE !== '1' || !story) return;
  const key = computeStoryCacheKey(intelligence, metadata, model);
  storyCache.set(key, story);
}

export function clearAllCaches() {
  extractionCache.clear();
  intelligenceMemoryCache.clear();
  storyCache.clear();
}

export function getCacheStats() {
  return {
    cachedExtractions: extractionCache.size,
    cachedIntelligenceMemories: intelligenceMemoryCache.size,
    cachedStories: storyCache.size,
  };
}
