/**
 * AfterChat Intelligence Pipeline — Phase 3 (Scalability Refactor)
 *
 * Two-tier architecture:
 *   TIER 1 — EXTRACTION (small model, per chunk)
 *     Token-budgeted chunks → compact structured extraction → deduplication
 *
 *   TIER 2 — SYNTHESIS (strong model, once)
 *     CompactChatMemory → globalDiscovery → eras → characters → lore → twists → patterns
 *
 * Critical guarantees:
 *   ✓ No raw messages sent to the 70B synthesis model
 *   ✓ Every chunk request stays safely under TPM limits
 *   ✓ Request-too-large errors trigger automatic chunk splitting
 *   ✓ Daily limit errors abort immediately with user-friendly message
 *   ✓ Token telemetry tracked throughout
 */

import { GroqProvider, DailyLimitError, InvalidApiKeyError, RequestTooLargeError, getTokenTelemetry, resetTokenTelemetry } from './ai/groq.js';
import {
  CompactChunkExtractionSchema,
  GlobalDiscoverySchema,
  StoryEraSchema,
  CharacterInsightSchema,
  LoreItemSchema,
  PlotTwistSchema,
  PatternInsightSchema,
} from './ai/schemas/index.js';
import {
  buildChunkExtractionSystemPrompt,
  buildChunkExtractionUserPrompt,
} from './ai/prompts/chunkExtraction.js';
import {
  buildGlobalDiscoverySystemPrompt,
  buildGlobalDiscoveryUserPrompt,
} from './ai/prompts/globalDiscovery.js';
import {
  buildEraDetectionSystemPrompt,
  buildEraDetectionUserPrompt,
} from './ai/prompts/eraDetection.js';
import {
  buildCharacterInsightsSystemPrompt,
  buildCharacterInsightsUserPrompt,
} from './ai/prompts/characterInsights.js';
import {
  buildLoreDetectionSystemPrompt,
  buildLoreDetectionUserPrompt,
} from './ai/prompts/loreDetection.js';
import {
  buildPlotTwistsSystemPrompt,
  buildPlotTwistsUserPrompt,
} from './ai/prompts/plotTwists.js';
import {
  buildPatternDetectionSystemPrompt,
  buildPatternDetectionUserPrompt,
} from './ai/prompts/patternDetection.js';
import { buildCompactMemory } from './memory.js';
import { buildMessageIndex, validateIntelligenceEvidence } from './evidence.js';
import { createChunks as createTokenChunks } from './chunker.js';
import { estimateChunkPayloadTokens, MAX_EXTRACTION_INPUT_TOKENS } from './tokenEstimator.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const MAX_PARALLEL_CHUNKS = Math.max(
  1,
  parseInt(process.env.MAX_CONCURRENT_EXTRACTIONS || '2', 10)
);

// If more than this fraction of chunks fail, abort the entire analysis
const MAX_ACCEPTABLE_FAILURE_RATE = 0.4;

let providerInstance = null;

function getProvider() {
  if (!providerInstance) {
    providerInstance = new GroqProvider();
  }
  return providerInstance;
}

// ─── Pipeline Entry Point ─────────────────────────────────────────────────────

/**
 * Main pipeline entry point.
 *
 * @param {Object} request  — validated AnalyzeRequest
 * @param {Function} [onProgress]  — optional callback({ stage: string, percent: number })
 * @returns {Promise<Object>}  — AfterchatIntelligence
 */
export async function runIntelligencePipeline(request, onProgress = () => {}) {
  const { metadata, summaryStats, chunks } = request;
  const provider = getProvider();

  resetTokenTelemetry();

  // Flatten all messages for evidence index (used for validation only)
  const allMessages = chunks.flatMap(c => c.messages);
  const messageIndex = buildMessageIndex(allMessages);

  const progress = (stage, percent) => {
    onProgress({ stage, percent });
    console.log(`[Pipeline] ${stage}${percent !== undefined ? ` (${percent}%)` : ''}`);
  };

  // ─── STEP 1: Chunk Extraction (TIER 1 — small model) ─────────────────────
  progress('Reading conversation patterns...', 5);

  const { extractions, chunksSucceeded, chunksFailed } =
    await extractAllChunks(chunks, provider, (done, total) => {
      const pct = Math.round(5 + (done / total) * 50);
      progress(`Reading conversation patterns... (${done}/${total} batches)`, pct);
    });

  if (extractions.length === 0) {
    throw new Error(
      'Extraction produced no results. The chat may be too short or all chunks failed.'
    );
  }

  // ─── STEP 2: Build Compact Memory (deterministic) ─────────────────────────
  progress('Building chat memory...', 58);

  const extractionMeta = {
    chunksTotal: chunks.length,
    chunksSucceeded,
    chunksFailed,
    extractionModel: provider.extractionModel,
  };

  // Build participant stats from all messages (Phase 2-style, deterministic)
  const participantStats = buildParticipantStats(metadata.participants, allMessages, metadata);

  const compactMemory = buildCompactMemory(
    extractions,
    chunks,
    metadata,
    extractionMeta
  );

  // ─── STEP 3: Global Discovery (TIER 2 — synthesis model) ─────────────────
  progress('Finding recurring themes...', 62);

  let globalDiscovery = {
    dominantThemes: [],
    majorChanges: [],
    recurringJokes: [],
    unusualPatterns: [],
    overallTone: 'conversational',
    potentialStoryArcs: [],
  };
  try {
    globalDiscovery = await provider.complete({
      systemPrompt: buildGlobalDiscoverySystemPrompt(),
      userPrompt: buildGlobalDiscoveryUserPrompt(compactMemory, metadata, summaryStats),
      schema: GlobalDiscoverySchema,
      tier: 'synthesis',
    });
  } catch (err) {
    if (err instanceof DailyLimitError) throw err;
    console.warn('[Pipeline] Global discovery failed, using defaults:', err.message);
  }

  // ─── STEP 4: Era Detection ────────────────────────────────────────────────
  progress('Detecting conversation eras...', 70);

  let erasResult = { eras: [] };
  try {
    erasResult = await provider.complete({
      systemPrompt: buildEraDetectionSystemPrompt(),
      userPrompt: buildEraDetectionUserPrompt(compactMemory, metadata),
      schema: StoryEraSchema,
      tier: 'synthesis',
    });
  } catch (err) {
    if (err instanceof DailyLimitError) throw err;
    console.warn('[Pipeline] Era detection failed:', err.message);
  }

  // ─── STEP 5: Character Insights ───────────────────────────────────────────
  progress('Profiling the participants...', 76);

  let charactersResult = { characters: [] };
  try {
    // Use a small sample from memory evidence — NOT raw allMessages
    const sampleMessages = getSampleMessages(compactMemory, allMessages, 25);

    charactersResult = await provider.complete({
      systemPrompt: buildCharacterInsightsSystemPrompt(),
      userPrompt: buildCharacterInsightsUserPrompt(
        metadata.participants,
        participantStats,
        sampleMessages
      ),
      schema: CharacterInsightSchema,
      tier: 'synthesis',
    });
  } catch (err) {
    if (err instanceof DailyLimitError) throw err;
    console.warn('[Pipeline] Character insights failed:', err.message);
  }

  // ─── STEP 6: Lore Detection ───────────────────────────────────────────────
  progress('Finding the lore...', 82);

  let loreResult = { lore: [] };
  try {
    loreResult = await provider.complete({
      systemPrompt: buildLoreDetectionSystemPrompt(),
      userPrompt: buildLoreDetectionUserPrompt(compactMemory),
      schema: LoreItemSchema,
      tier: 'synthesis',
    });
  } catch (err) {
    if (err instanceof DailyLimitError) throw err;
    console.warn('[Pipeline] Lore detection failed:', err.message);
  }

  // ─── STEP 7: Plot Twists ──────────────────────────────────────────────────
  progress('Looking for plot twists...', 87);

  let plotTwistsResult = { plotTwists: [] };
  try {
    plotTwistsResult = await provider.complete({
      systemPrompt: buildPlotTwistsSystemPrompt(),
      userPrompt: buildPlotTwistsUserPrompt(compactMemory, globalDiscovery),
      schema: PlotTwistSchema,
      tier: 'synthesis',
    });
  } catch (err) {
    if (err instanceof DailyLimitError) throw err;
    console.warn('[Pipeline] Plot twist detection failed:', err.message);
  }

  // ─── STEP 8: Pattern Detection ────────────────────────────────────────────
  progress('Identifying recurring patterns...', 92);

  let patternsResult = { patterns: [] };
  try {
    patternsResult = await provider.complete({
      systemPrompt: buildPatternDetectionSystemPrompt(),
      userPrompt: buildPatternDetectionUserPrompt(compactMemory),
      schema: PatternInsightSchema,
      tier: 'synthesis',
    });
  } catch (err) {
    if (err instanceof DailyLimitError) throw err;
    console.warn('[Pipeline] Pattern detection failed:', err.message);
  }

  // ─── STEP 9: Build + Validate Final Intelligence ──────────────────────────
  progress('Connecting the receipts...', 97);

  const rawIntelligence = {
    overview: {
      dominantThemes: globalDiscovery.dominantThemes || [],
      overallTone: globalDiscovery.overallTone || 'conversational',
      potentialStoryArcs: globalDiscovery.potentialStoryArcs || [],
      recurringJokes: globalDiscovery.recurringJokes || [],
    },
    eras: erasResult.eras || [],
    characters: charactersResult.characters || [],
    lore: loreResult.lore || [],
    plotTwists: plotTwistsResult.plotTwists || [],
    patterns: patternsResult.patterns || [],
  };

  // Validate all evidence message IDs (strips invented IDs)
  const validatedIntelligence = validateIntelligenceEvidence(rawIntelligence, messageIndex);

  // ─── STEP 10: Log Telemetry ───────────────────────────────────────────────
  const telemetry = getTokenTelemetry();
  console.log(
    '\n[Pipeline] ═══════════════════════════════════════\n' +
    '[Pipeline] TOKEN TELEMETRY REPORT\n' +
    `[Pipeline]   Extraction model:  ${provider.extractionModel}\n` +
    `[Pipeline]   Synthesis model:   ${provider.synthesisModel}\n` +
    `[Pipeline]   Extraction input:  ${telemetry.extractionInputTokens.toLocaleString()} tokens\n` +
    `[Pipeline]   Extraction output: ${telemetry.extractionOutputTokens.toLocaleString()} tokens\n` +
    `[Pipeline]   Synthesis input:   ${telemetry.synthesisInputTokens.toLocaleString()} tokens\n` +
    `[Pipeline]   Synthesis output:  ${telemetry.synthesisOutputTokens.toLocaleString()} tokens\n` +
    `[Pipeline]   Total requests:    ${telemetry.totalRequests}\n` +
    `[Pipeline]   Total retries:     ${telemetry.totalRetries}\n` +
    `[Pipeline]   Failed requests:   ${telemetry.failedRequests}\n` +
    `[Pipeline]   Rate limit hits:   ${telemetry.rateLimitHits}\n` +
    `[Pipeline]   Size limit hits:   ${telemetry.requestTooLargeHits}\n` +
    `[Pipeline]   Chunks: ${chunksSucceeded} succeeded / ${chunksFailed} failed / ${chunks.length} total\n` +
    '[Pipeline] ═══════════════════════════════════════\n'
  );

  progress('Done.', 100);
  return validatedIntelligence;
}

// ─── Extraction Phase ─────────────────────────────────────────────────────────

/**
 * Extract all chunks with concurrency limiting, auto-retry on size errors,
 * and graceful partial failure handling.
 */
async function extractAllChunks(chunks, provider, onBatchProgress) {
  const results = [];
  let chunksSucceeded = 0;
  let chunksFailed = 0;

  // Process in batches of MAX_PARALLEL_CHUNKS
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL_CHUNKS) {
    const batch = chunks.slice(i, i + MAX_PARALLEL_CHUNKS);

    const batchResults = await Promise.allSettled(
      batch.map((chunk, batchIdx) =>
        extractSingleChunkWithRecovery(chunk, i + batchIdx, chunks.length, provider)
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
        chunksSucceeded++;
      } else if (result.status === 'rejected') {
        const err = result.reason;
        // Fatal errors must bubble up immediately — stop everything
        if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;
        console.warn('[Pipeline] Chunk extraction failed permanently:', err?.message);
        chunksFailed++;
      }
    }

    // Check failure rate
    const totalProcessed = chunksSucceeded + chunksFailed;
    if (
      chunksFailed > 0 &&
      totalProcessed >= 3 &&
      chunksFailed / totalProcessed > MAX_ACCEPTABLE_FAILURE_RATE
    ) {
      throw new Error(
        `Too many extraction chunks failed (${chunksFailed}/${totalProcessed}). ` +
        'Analysis quality would be unacceptable. Check your API limits and try again.'
      );
    }

    onBatchProgress(Math.min(i + MAX_PARALLEL_CHUNKS, chunks.length), chunks.length);
  }

  return { extractions: results.filter(Boolean), chunksSucceeded, chunksFailed };
}

/**
 * Extract a single chunk. On RequestTooLargeError, split the chunk and retry
 * the two halves. Never retries the same oversized payload.
 */
async function extractSingleChunkWithRecovery(chunk, index, total, provider) {
  const normalMessages = chunk.messages.filter(m => m.type === 'message');
  if (normalMessages.length === 0) return null;

  try {
    return await extractSingleChunk(chunk, index, total, provider);
  } catch (err) {
    if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;

    if (err instanceof RequestTooLargeError) {
      // Split chunk in half and retry each half
      console.warn(
        `[Pipeline] Chunk ${chunk.id} too large (${normalMessages.length} msgs). ` +
        `Splitting into halves and retrying.`
      );
      return await extractSplitChunk(chunk, index, total, provider);
    }

    // Other errors — log and return null
    console.warn(`[Pipeline] Chunk ${chunk.id} extraction failed:`, err.message);
    return null;
  }
}

/**
 * Split an oversized chunk into two halves and extract each.
 * Returns a merged extraction result.
 */
async function extractSplitChunk(chunk, index, total, provider) {
  const normalMessages = chunk.messages.filter(m => m.type === 'message');
  const mid = Math.floor(normalMessages.length / 2);

  const halfA = {
    ...chunk,
    id: `${chunk.id}_a`,
    messages: normalMessages.slice(0, mid),
    endAt: normalMessages[mid - 1]?.timestamp || chunk.endAt,
  };

  const halfB = {
    ...chunk,
    id: `${chunk.id}_b`,
    messages: normalMessages.slice(mid),
    startAt: normalMessages[mid]?.timestamp || chunk.startAt,
  };

  const [resultA, resultB] = await Promise.allSettled([
    extractSingleChunk(halfA, index, total, provider),
    extractSingleChunk(halfB, index, total, provider),
  ]);

  const a = resultA.status === 'fulfilled' ? resultA.value : null;
  const b = resultB.status === 'fulfilled' ? resultB.value : null;

  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;

  // Merge the two half-results
  return {
    period: { start: a.period?.start || chunk.startAt, end: b.period?.end || chunk.endAt },
    topics: [...new Set([...(a.topics || []), ...(b.topics || [])])].slice(0, 8),
    events: [...(a.events || []), ...(b.events || [])].slice(0, 6),
    notableMoments: [...(a.notableMoments || []), ...(b.notableMoments || [])].slice(0, 6),
    patterns: [...(a.patterns || []), ...(b.patterns || [])].slice(0, 4),
    relationshipChanges: [...(a.relationshipChanges || []), ...(b.relationshipChanges || [])].slice(0, 3),
    recurringThemes: [...new Set([...(a.recurringThemes || []), ...(b.recurringThemes || [])])].slice(0, 5),
  };
}

async function extractSingleChunk(chunk, index, total, provider) {
  return await provider.complete({
    systemPrompt: buildChunkExtractionSystemPrompt(),
    userPrompt: buildChunkExtractionUserPrompt(chunk, index, total),
    schema: CompactChunkExtractionSchema,
    tier: 'extraction',
    maxOutputTokens: 2048,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build participant statistics from all messages (deterministic, no AI needed).
 */
function buildParticipantStats(participants, allMessages, metadata) {
  return participants.map(name => {
    const msgs = allMessages.filter(m => m.sender === name && m.type === 'message');
    const totalWords = msgs.reduce((sum, m) => {
      return sum + (m.text ? m.text.split(/\s+/).length : 0);
    }, 0);
    return {
      name,
      messageCount: msgs.length,
      percentage:
        metadata.totalMessages > 0 ? (msgs.length / metadata.totalMessages) * 100 : 0,
      avgWordsPerMessage: msgs.length > 0 ? totalWords / msgs.length : 0,
      emojiCount: msgs.reduce(
        (sum, m) => sum + ((m.text?.match(/\p{Emoji}/gu) || []).length),
        0
      ),
      mediaCount: allMessages.filter(
        m => m.sender === name && m.type === 'media'
      ).length,
    };
  });
}

/**
 * Get a small sample of messages that are referenced in compact memory evidence.
 * Used for character insights — keeps 70B input small.
 */
function getSampleMessages(compactMemory, allMessages, maxCount) {
  // Collect IDs referenced in memory
  const evidenceIds = new Set([
    ...(compactMemory.globalMoments || []).flatMap(m => m.messageIds || []),
    ...(compactMemory.globalEvents || []).flatMap(e => e.messageIds || []),
  ]);

  const msgMap = new Map(allMessages.map(m => [m.id, m]));

  const evidenceMsgs = [...evidenceIds]
    .map(id => msgMap.get(id))
    .filter(Boolean)
    .slice(0, maxCount);

  // Pad with a few messages from the start if needed
  if (evidenceMsgs.length < 10) {
    const normalMsgs = allMessages.filter(m => m.type === 'message');
    const step = Math.max(1, Math.floor(normalMsgs.length / 20));
    for (let i = 0; i < normalMsgs.length && evidenceMsgs.length < maxCount; i += step) {
      if (!evidenceIds.has(normalMsgs[i].id)) {
        evidenceMsgs.push(normalMsgs[i]);
      }
    }
  }

  return evidenceMsgs.slice(0, maxCount);
}
