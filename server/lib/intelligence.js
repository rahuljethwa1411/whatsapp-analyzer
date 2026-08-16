/**
 * AfterChat Intelligence Pipeline
 * Orchestrates the full Phase 3 analysis:
 * chunks → extraction → memory → global → eras → characters → lore → twists → patterns → evidence validation
 */

import { GroqProvider } from './ai/groq.js';
import {
  ChunkInsightSchema,
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
import { buildChatMemory } from './memory.js';
import { buildMessageIndex, validateIntelligenceEvidence } from './evidence.js';

const MAX_PARALLEL_CHUNKS = 3;

let providerInstance = null;

function getProvider() {
  if (!providerInstance) {
    providerInstance = new GroqProvider();
  }
  return providerInstance;
}

/**
 * Main pipeline entry point.
 * @param {Object} request  — validated AnalyzeRequest
 * @param {Function} [onProgress]  — optional callback(stage: string)
 * @returns {Promise<Object>}  — AfterchatIntelligence
 */
export async function runIntelligencePipeline(request, onProgress = () => {}) {
  const { metadata, summaryStats, chunks } = request;

  // Flatten all messages across chunks for evidence retrieval
  const allMessages = chunks.flatMap(c => c.messages);
  const messageIndex = buildMessageIndex(allMessages);

  // ─── STEP 1: Chunk Extraction ──────────────────────────────────────────────
  onProgress('Analyzing conversation chunks...');
  const chunkInsights = await extractChunks(chunks, getProvider());

  // ─── STEP 2: Build Chat Memory ────────────────────────────────────────────
  onProgress('Building chat memory...');
  const chatMemory = buildChatMemory(chunkInsights, chunks);

  // ─── STEP 3: Global Discovery ─────────────────────────────────────────────
  onProgress('Finding recurring themes...');
  let globalDiscovery = { dominantThemes: [], majorChanges: [], recurringJokes: [], unusualPatterns: [], overallTone: 'conversational', potentialStoryArcs: [] };
  try {
    globalDiscovery = await getProvider().complete({
      systemPrompt: buildGlobalDiscoverySystemPrompt(),
      userPrompt: buildGlobalDiscoveryUserPrompt(chatMemory, metadata, summaryStats),
      schema: GlobalDiscoverySchema,
    });
  } catch (err) {
    console.warn('[Pipeline] Global discovery failed, using defaults:', err.message);
  }

  // ─── STEP 4: Era Detection ────────────────────────────────────────────────
  onProgress('Detecting conversation eras...');
  let erasResult = { eras: [] };
  try {
    erasResult = await getProvider().complete({
      systemPrompt: buildEraDetectionSystemPrompt(),
      userPrompt: buildEraDetectionUserPrompt(chatMemory, metadata),
      schema: StoryEraSchema,
    });
  } catch (err) {
    console.warn('[Pipeline] Era detection failed:', err.message);
  }

  // ─── STEP 5: Character Insights ───────────────────────────────────────────
  onProgress('Profiling the participants...');
  let charactersResult = { characters: [] };
  try {
    // Sample messages for character insight (spread across chunks)
    const sampleMessages = chunks
      .flatMap(c => c.messages.filter(m => m.type === 'message').slice(0, 5))
      .slice(0, 30);

    // Build participant stats from chunk insights (approximate)
    const participantStats = metadata.participants.map(name => {
      const msgs = allMessages.filter(m => m.sender === name && m.type === 'message');
      const totalWords = msgs.reduce((sum, m) => sum + m.text.split(/\s+/).length, 0);
      return {
        name,
        messageCount: msgs.length,
        percentage: metadata.totalMessages > 0 ? (msgs.length / metadata.totalMessages) * 100 : 0,
        avgWordsPerMessage: msgs.length > 0 ? totalWords / msgs.length : 0,
        emojiCount: msgs.reduce((sum, m) => sum + (m.text.match(/\p{Emoji}/gu) || []).length, 0),
        mediaCount: allMessages.filter(m => m.sender === name && m.type === 'media').length,
      };
    });

    charactersResult = await getProvider().complete({
      systemPrompt: buildCharacterInsightsSystemPrompt(),
      userPrompt: buildCharacterInsightsUserPrompt(metadata.participants, participantStats, sampleMessages),
      schema: CharacterInsightSchema,
    });
  } catch (err) {
    console.warn('[Pipeline] Character insights failed:', err.message);
  }

  // ─── STEP 6: Lore Detection ───────────────────────────────────────────────
  onProgress('Finding the lore...');
  let loreResult = { lore: [] };
  try {
    loreResult = await getProvider().complete({
      systemPrompt: buildLoreDetectionSystemPrompt(),
      userPrompt: buildLoreDetectionUserPrompt(chunkInsights, allMessages),
      schema: LoreItemSchema,
    });
  } catch (err) {
    console.warn('[Pipeline] Lore detection failed:', err.message);
  }

  // ─── STEP 7: Plot Twists ──────────────────────────────────────────────────
  onProgress('Looking for plot twists...');
  let plotTwistsResult = { plotTwists: [] };
  try {
    plotTwistsResult = await getProvider().complete({
      systemPrompt: buildPlotTwistsSystemPrompt(),
      userPrompt: buildPlotTwistsUserPrompt(chatMemory, globalDiscovery, allMessages),
      schema: PlotTwistSchema,
    });
  } catch (err) {
    console.warn('[Pipeline] Plot twist detection failed:', err.message);
  }

  // ─── STEP 8: Pattern Detection ────────────────────────────────────────────
  onProgress('Identifying recurring patterns...');
  let patternsResult = { patterns: [] };
  try {
    patternsResult = await getProvider().complete({
      systemPrompt: buildPatternDetectionSystemPrompt(),
      userPrompt: buildPatternDetectionUserPrompt(chatMemory, chunkInsights),
      schema: PatternInsightSchema,
    });
  } catch (err) {
    console.warn('[Pipeline] Pattern detection failed:', err.message);
  }

  // ─── STEP 9: Build & Validate Final Intelligence ──────────────────────────
  onProgress('Connecting the receipts...');

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

  // Validate all evidence message IDs
  const validatedIntelligence = validateIntelligenceEvidence(rawIntelligence, messageIndex);

  onProgress('Done.');
  return validatedIntelligence;
}

/**
 * Extract chunk insights with concurrency limiting.
 */
async function extractChunks(chunks, provider) {
  const results = [];

  for (let i = 0; i < chunks.length; i += MAX_PARALLEL_CHUNKS) {
    const batch = chunks.slice(i, i + MAX_PARALLEL_CHUNKS);
    const batchResults = await Promise.allSettled(
      batch.map((chunk, batchIdx) =>
        extractSingleChunk(chunk, i + batchIdx, chunks.length, provider)
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      } else if (result.status === 'rejected') {
        console.warn('[Pipeline] Chunk extraction failed, skipping:', result.reason?.message);
      }
    }
  }

  return results;
}

async function extractSingleChunk(chunk, index, total, provider) {
  // Skip system/media only chunks
  const normalMessages = chunk.messages.filter(m => m.type === 'message');
  if (normalMessages.length === 0) return null;

  try {
    return await provider.complete({
      systemPrompt: buildChunkExtractionSystemPrompt(),
      userPrompt: buildChunkExtractionUserPrompt(chunk, index, total),
      schema: ChunkInsightSchema,
    });
  } catch (err) {
    console.warn(`[Pipeline] Chunk ${chunk.id} extraction failed:`, err.message);
    // Return minimal fallback
    return {
      chunkId: chunk.id,
      topics: [],
      events: [],
      moments: [],
      recurringPhrases: [],
      toneSignals: [],
    };
  }
}
