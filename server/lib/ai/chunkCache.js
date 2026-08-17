import crypto from 'crypto';

/**
 * Extraction Chunk Cache
 *
 * Deterministic caching of extraction results for development & retry speed.
 * Cache key is derived from:
 *   - chunk ID and exact message sequence (IDs and texts)
 *   - extraction model name
 *   - extraction schema / prompt version
 *
 * Automatically invalidates when any message, model, or schema version changes.
 */

const EXTRACTION_SCHEMA_VERSION = 'v3_structured_evidence';
const memoryCache = new Map();

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
  return memoryCache.get(key) || null;
}

export function setCachedExtraction(chunk, model = '', extraction) {
  if (process.env.DISABLE_EXTRACTION_CACHE === '1' || !extraction) return;
  const key = computeChunkCacheKey(chunk, model);
  memoryCache.set(key, extraction);
}

export function clearChunkCache() {
  memoryCache.clear();
}

export function getChunkCacheStats() {
  return {
    cachedChunks: memoryCache.size,
  };
}
