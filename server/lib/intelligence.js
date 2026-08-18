/**
 * AfterChat Intelligence Pipeline (OpenAI Multi-Tier Edition).
 *
 * Tiered Architecture:
 *   TIER 1 — EXTRACTION (gpt-4o-mini, Structured Outputs per logical chunk)
 *     ~20 logical chunks → preflight token safety → adaptive binary token-weighted recovery → local deduplication
 *
 *   TIER 2 — GLOBAL INTELLIGENCE MEMORY (gpt-5-mini, Structured Outputs across all extractions)
 *     Compact intermediate representation → global cross-chunk reasoning (eras, dynamics, callbacks, contradictions, lore)
 *
 * Key Guarantees:
 *   ✓ 23,979 messages produce ~20 logical chunks (progress 1/20 .. 20/20)
 *   ✓ Recovery subchunks merge internally and never inflate logical chunk count
 *   ✓ No raw messages sent to the synthesis/story models
 *   ✓ Bounded concurrency (MAX_CONCURRENT_EXTRACTIONS) with rate-limit backoff
 *   ✓ Full OpenAI token and cost telemetry tracking
 */

import {
  getOpenAIService,
  DailyLimitError,
  InvalidApiKeyError,
  getTokenTelemetry,
  resetTokenTelemetry,
  recordExtractionRecoverySplit,
  recordExtractionCacheHit,
  recordPartiallyRecoveredChunk,
  recordExtractionSchemaNormalization,
  recordExtractionEvidenceOverflow,
} from './ai/openaiClient.js';
import {
  getCachedExtraction,
  setCachedExtraction,
  getCachedIntelligenceMemory,
  setCachedIntelligenceMemory,
} from './ai/chunkCache.js';
import {
  RelationshipInvestigatorSchema,
} from './ai/schemas/index.js';
import {
  buildExtractionRequest,
  getExtractionRequestDiagnostics,
  getExtractionSchema,
} from './ai/extractionRequest.js';
import {
  buildInvestigatorSystemPrompt,
  buildInvestigatorUserPrompt,
} from './ai/prompts/investigator.js';
import { buildCompactMemory } from './memory.js';
import {
  buildMessageIndex,
  validateIntelligenceEvidence,
  buildEvidenceStore,
  formatEvidenceForPrompt,
  validateInvestigatorRefs,
  validateChunkExtractionEvidence,
  normalizeExtractionResult,
} from './evidence.js';
import { buildVerifiedConversationMemory } from './evidenceIntelligence.js';
import {
  splitMessagesByTokenWeight,
} from './chunker.js';
import {
  estimateExtractionRequest,
  SAFE_EXTRACTION_INPUT_TOKENS,
  MAX_RECOVERY_DEPTH,
  MAX_CONCURRENT_EXTRACTIONS,
  EVIDENCE_MAX_OUTPUT_TOKENS,
} from './tokenEstimator.js';
import { getModelForTier } from './ai/modelConfig.js';

const MAX_ACCEPTABLE_FAILURE_RATE = 0.6;

// ─── Pipeline Entry Point ─────────────────────────────────────────────────────

/**
 * Main intelligence pipeline entry point.
 *
 * @param {Object} request  — validated AnalyzeRequest
 * @param {Function} [onProgress]  — optional callback({ stage: string, percent: number })
 * @returns {Promise<Object>}  — AfterchatIntelligence
 */
export async function runIntelligencePipeline(request, onProgress = () => {}) {
  const { metadata, summaryStats, chunks } = request;
  const extractionModel = getModelForTier('extraction');
  const evidenceModel = getModelForTier('evidence');

  resetTokenTelemetry();

  // Flatten all messages for evidence index (used for deterministic validation)
  const allMessages = chunks.flatMap((c) => c.messages);
  const messageIndex = buildMessageIndex(allMessages);

  const progress = (stage, percent) => {
    onProgress({ stage, percent });
    console.log(`[Pipeline] ${stage}${percent !== undefined ? ` (${percent}%)` : ''}`);
  };

  // ─── STEP 1: Chunk Extraction (TIER 1 — gpt-4o-mini) ─────────────────────
  progress('Reading conversation patterns...', 5);

  const { extractions, chunksSucceeded, chunksRecovered, chunksFailed } =
    await extractAllChunks(chunks, extractionModel, (done, total) => {
      const pct = Math.round(5 + (done / total) * 50);
      progress(`Reading conversation patterns... (${done}/${total} logical chunks)`, pct);
    });

  if (extractions.length === 0) {
    throw new Error(
      'Extraction produced no results. The chat may be too short or all chunks failed.'
    );
  }

  // ─── STEP 2: Build Compact Memory & Deduplicated Evidence Store ───────────
  progress('Building global intelligence memory...', 58);

  const extractionMeta = {
    chunksTotal: chunks.length,
    chunksSucceeded,
    chunksRecovered,
    chunksFailed,
    extractionModel,
  };

  // Validates messageIds, reconstructs dynamic context windows, and deduplicates interactions
  const evidenceStore = buildEvidenceStore(extractions, messageIndex, allMessages);

  const participantStats = buildParticipantStats(metadata.participants, allMessages, metadata);

  const compactMemory = buildCompactMemory(
    extractions,
    chunks,
    metadata,
    extractionMeta
  );

  // ─── STEP 3: Relationship Investigator (TIER 2 — gpt-5-mini Synthesis) ───
  progress('Investigating global dynamics & callbacks...', 68);

  const formattedEvidence = formatEvidenceForPrompt(evidenceStore, 120);
  const openaiService = getOpenAIService();
  let rawInvestigatorResult = null;

  const cachedMemory = getCachedIntelligenceMemory(extractions, metadata, evidenceModel);
  if (cachedMemory) {
    console.log('[Pipeline] ✓ Cache hit for global intelligence memory');
    rawInvestigatorResult = cachedMemory;
  } else {
    try {
      rawInvestigatorResult = await openaiService.completeStructured({
        model: evidenceModel,
        tier: 'evidence',
        systemPrompt: buildInvestigatorSystemPrompt(),
        userPrompt: buildInvestigatorUserPrompt({
          metadata,
          summaryStats,
          participantStats,
          compactMemory,
          formattedEvidence,
          evidenceCount: Math.min(evidenceStore.length, 50),
        }),
        schema: RelationshipInvestigatorSchema,
        schemaName: 'RelationshipInvestigatorBlueprint',
        maxOutputTokens: EVIDENCE_MAX_OUTPUT_TOKENS,
        temperature: 0.2,
      });
      setCachedIntelligenceMemory(extractions, metadata, evidenceModel, rawInvestigatorResult);
    } catch (err) {
      if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;
      console.warn('[Pipeline] Relationship investigator initial attempt failed:', err.message);

      // Attempt one structured repair pass
      try {
        console.log('[Pipeline] Attempting one structured repair pass for relationship investigator...');
        rawInvestigatorResult = await openaiService.completeStructured({
          model: evidenceModel,
          tier: 'evidence',
          systemPrompt: buildInvestigatorSystemPrompt() + '\n\nIMPORTANT: Output MUST be 100% strictly valid JSON matching the exact schema.',
          userPrompt: buildInvestigatorUserPrompt({
            metadata,
            summaryStats,
            participantStats,
            compactMemory,
            formattedEvidence,
            evidenceCount: Math.min(evidenceStore.length, 50),
          }),
          schema: RelationshipInvestigatorSchema,
          schemaName: 'RelationshipInvestigatorBlueprint',
          maxOutputTokens: EVIDENCE_MAX_OUTPUT_TOKENS,
          temperature: 0.1,
        });
        console.log('[Pipeline] ✓ Structured repair succeeded.');
        setCachedIntelligenceMemory(extractions, metadata, evidenceModel, rawInvestigatorResult);
      } catch (repairErr) {
        if (repairErr instanceof DailyLimitError || repairErr instanceof InvalidApiKeyError) throw repairErr;
        console.warn('[Pipeline] Structured repair failed, using evidence-grounded baseline:', repairErr.message);
        rawInvestigatorResult = buildFallbackInvestigatorResult(metadata, compactMemory, evidenceStore);
      }
    }
  }

  // ─── STEP 4: Validate Evidence References & Build Verified Memory ────────
  progress('Connecting the receipts...', 92);

  const { validatedResult: investigatorResult, validCount, strippedCount } =
    validateInvestigatorRefs(rawInvestigatorResult, messageIndex);

  const conversationMemory = buildVerifiedConversationMemory({
    evidenceStore,
    rawInvestigatorResult: investigatorResult,
    metadata,
    summaryStats,
  });

  // ─── STEP 5: Map to AfterchatIntelligence ────────────────────────────────
  progress('Finalizing intelligence archive...', 96);

  const mappedIntelligence = mapInvestigatorToLegacyIntelligence(
    investigatorResult,
    extractionMeta,
    evidenceStore,
    conversationMemory
  );

  const validatedIntelligence = validateIntelligenceEvidence(mappedIntelligence, messageIndex);

  // ─── STEP 6: Telemetry Summary ───────────────────────────────────────────
  const telemetry = getTokenTelemetry();
  console.log(
    '\n==================================================\n' +
    'OPENAI INTELLIGENCE TELEMETRY\n' +
    '==================================================\n' +
    `Provider:                       ${telemetry.provider}\n` +
    `Extraction Model:               ${telemetry.extractionModel}\n` +
    `Evidence Model:                 ${telemetry.evidenceModel}\n` +
    `Story Model:                    ${telemetry.storyModel}\n\n` +
    `Original logical chunks:        ${chunks.length}\n` +
    `Successful logical chunks:      ${chunksSucceeded}\n` +
    `Recovered logical chunks:       ${chunksRecovered}\n` +
    `Partially recovered chunks:     ${telemetry.partiallyRecoveredChunks}\n` +
    `Failed logical chunks:          ${chunksFailed}\n\n` +
    `Physical API requests:          ${telemetry.physicalExtractionRequests + telemetry.tierUsage.evidence.calls + telemetry.tierUsage.story.calls}\n` +
    `Recovery splits:                ${telemetry.recoverySplits}\n` +
    `Retries:                        ${telemetry.retries}\n` +
    `Rate limit 429s:                ${telemetry.rateLimit429s}\n\n` +
    `Total Input Tokens:             ${telemetry.inputTokens.toLocaleString()}\n` +
    `Cached Input Tokens:            ${telemetry.cachedInputTokens.toLocaleString()}\n` +
    `Total Output Tokens:            ${telemetry.outputTokens.toLocaleString()}\n` +
    `Total Tokens:                   ${telemetry.totalTokens.toLocaleString()}\n\n` +
    `Extraction Cost Estimate:       $${telemetry.costs.extractionCostUsd.toFixed(5)}\n` +
    `Evidence Cost Estimate:         $${telemetry.costs.evidenceCostUsd.toFixed(5)}\n` +
    `Total Pipeline Cost Estimate:   $${telemetry.costs.totalCostUsd.toFixed(5)}\n` +
    '==================================================\n'
  );

  progress('Done.', 100);
  return validatedIntelligence;
}

// ─── Extraction Phase: Bounded Concurrency & Recovery ─────────────────────────

/**
 * Extracts all logical chunks with bounded concurrency (MAX_CONCURRENT_EXTRACTIONS).
 */
async function extractAllChunks(chunks, extractionModel, onBatchProgress) {
  const results = [];
  let chunksSucceeded = 0;
  let chunksRecovered = 0;
  let chunksFailed = 0;

  const concurrencyLimit = MAX_CONCURRENT_EXTRACTIONS;

  for (let i = 0; i < chunks.length; i += concurrencyLimit) {
    const batch = chunks.slice(i, i + concurrencyLimit);

    const batchResults = await Promise.allSettled(
      batch.map((chunk, batchIdx) =>
        extractLogicalChunkWithAdaptiveRecovery(chunk, i + batchIdx, chunks.length, extractionModel)
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value?.ok) {
        results.push(result.value.extraction);
        chunksSucceeded++;
        if (result.value.recovered) chunksRecovered++;
      } else if (result.status === 'fulfilled') {
        console.warn('[Pipeline] Logical chunk extraction failed:', result.value?.error || 'unknown error');
        chunksFailed++;
      } else if (result.status === 'rejected') {
        const err = result.reason;
        if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;
        console.warn('[Pipeline] Logical chunk extraction exception:', err?.message);
        chunksFailed++;
      }
    }

    const totalProcessed = chunksSucceeded + chunksFailed;
    if (
      chunksFailed > 0 &&
      totalProcessed >= 5 &&
      chunksFailed / totalProcessed > MAX_ACCEPTABLE_FAILURE_RATE
    ) {
      throw new Error(
        `Too many extraction chunks failed (${chunksFailed}/${totalProcessed}). ` +
        'Analysis quality would be unacceptable. Check your OpenAI API limits and try again.'
      );
    }

    onBatchProgress(Math.min(i + concurrencyLimit, chunks.length), chunks.length);
  }

  const extractions = results.filter(Boolean);
  const totalEvidenceItems = extractions.reduce((sum, e) => sum + (e.evidence?.length || 0), 0);
  console.log(
    `\n[Pipeline] 🏁 Extraction complete: ${chunksSucceeded}/${chunks.length} logical chunks succeeded ` +
    `(${chunksRecovered} recovered, ${chunksFailed} failed). Total verified evidence items: ${totalEvidenceItems}.\n`
  );

  return { extractions, chunksSucceeded, chunksRecovered, chunksFailed };
}

/**
 * Extracts a single logical chunk with token-aware preflight and adaptive recursive splitting.
 */
export async function extractLogicalChunkWithAdaptiveRecovery(
  logicalChunk,
  index,
  total,
  model,
  depth = 0
) {
  const normalMessages = (logicalChunk.messages || []).filter((m) => m.type === 'message');
  if (normalMessages.length === 0) {
    return { ok: false, recovered: false, error: `${logicalChunk.id} has no extractable messages` };
  }

  // 1. Check cache first
  const cached = getCachedExtraction(logicalChunk, model);
  if (cached) {
    recordExtractionCacheHit();
    return { ok: true, recovered: false, extraction: cached, fromCache: true };
  }

  // 2. Build extraction request
  const request = buildExtractionRequest(logicalChunk, index, total, { model });
  const tokenInfo = estimateExtractionRequest(request);

  // 3. Pre-flight check: if request is oversized, split adaptively at token boundaries
  if (!tokenInfo.safe) {
    if (depth >= MAX_RECOVERY_DEPTH) {
      console.warn(`[Pipeline] Max recovery depth ${MAX_RECOVERY_DEPTH} reached for ${logicalChunk.id}. Retaining within bounds.`);
    } else {
      recordExtractionRecoverySplit();
      console.warn(
        `⚡ [TOKEN SPLIT] ${logicalChunk.id} (depth ${depth}): estimated ~${tokenInfo.estimatedInputTokens} input tokens > safe budget ${tokenInfo.safeBudget}. Splitting token-weighted.`
      );
      return splitAndExtractSubchunks(logicalChunk, index, total, model, depth);
    }
  }

  // 4. Execute Structured Output Extraction
  const openaiService = getOpenAIService();
  try {
    const rawExtraction = await openaiService.completeStructured({
      model,
      tier: 'extraction',
      systemPrompt: request.messages.find((m) => m.role === 'system')?.content,
      userPrompt: request.messages.find((m) => m.role === 'user')?.content,
      schema: request.schema,
      schemaName: 'ChunkEvidenceExtraction',
      temperature: 0.1,
      maxOutputTokens: request.max_tokens,
    });

    const { extraction } = validateChunkExtractionEvidence(rawExtraction, logicalChunk);
    setCachedExtraction(logicalChunk, model, extraction);

    return {
      ok: true,
      recovered: depth > 0,
      extraction,
    };
  } catch (err) {
    if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;

    // If request was too large or failed, split if depth allows
    if (depth < MAX_RECOVERY_DEPTH && normalMessages.length > 1) {
      recordExtractionRecoverySplit();
      console.warn(`[Pipeline] Extraction failed for ${logicalChunk.id} (${err.message}). Attempting recovery split at depth ${depth + 1}...`);
      return splitAndExtractSubchunks(logicalChunk, index, total, model, depth);
    }

    console.error(`[Pipeline] Extraction failed permanently for ${logicalChunk.id}: ${err.message}`);
    return {
      ok: false,
      recovered: false,
      error: err.message,
    };
  }
}

/**
 * Splits messages by token weight and extracts both subchunks recursively, merging results.
 */
async function splitAndExtractSubchunks(logicalChunk, index, total, model, depth) {
  const normalMessages = logicalChunk.messages.filter((m) => m.type === 'message');
  const [leftMsgs, rightMsgs] = splitMessagesByTokenWeight(normalMessages);

  if (leftMsgs.length === 0 || rightMsgs.length === 0) {
    return { ok: false, recovered: false, error: 'Cannot split further' };
  }

  const leftChunk = {
    ...logicalChunk,
    id: `${logicalChunk.id}a`,
    messages: leftMsgs,
    startAt: leftMsgs[0]?.timestamp || logicalChunk.startAt,
    endAt: leftMsgs[leftMsgs.length - 1]?.timestamp || logicalChunk.endAt,
  };

  const rightChunk = {
    ...logicalChunk,
    id: `${logicalChunk.id}b`,
    messages: rightMsgs,
    startAt: rightMsgs[0]?.timestamp || logicalChunk.startAt,
    endAt: rightMsgs[rightMsgs.length - 1]?.timestamp || logicalChunk.endAt,
  };

  const [leftRes, rightRes] = await Promise.all([
    extractLogicalChunkWithAdaptiveRecovery(leftChunk, index, total, model, depth + 1),
    extractLogicalChunkWithAdaptiveRecovery(rightChunk, index, total, model, depth + 1),
  ]);

  const successfulExtractions = [leftRes?.extraction, rightRes?.extraction].filter(Boolean);

  if (successfulExtractions.length === 0) {
    return { ok: false, recovered: true, error: `Both split subchunks failed for ${logicalChunk.id}` };
  }

  const isPartial = successfulExtractions.length === 1;
  if (isPartial) {
    recordPartiallyRecoveredChunk();
    console.warn(`⚠️ [PARTIAL RECOVERY] ${logicalChunk.id}: 1 of 2 subchunks recovered.`);
  }

  const merged = mergeExtractionResults(logicalChunk, successfulExtractions);
  setCachedExtraction(logicalChunk, model, merged);

  return {
    ok: true,
    recovered: true,
    partiallyRecovered: isPartial,
    extraction: merged,
  };
}

/**
 * Merges extraction results from subchunks into a single logical chunk result.
 */
export function mergeExtractionResults(logicalChunk, extractions) {
  const allEvidence = [];
  const allTopics = [];
  const allThemes = [];

  for (const ext of extractions) {
    if (Array.isArray(ext.evidence)) {
      allEvidence.push(...ext.evidence);
    }
    if (Array.isArray(ext.topics)) {
      allTopics.push(...ext.topics);
    }
    if (Array.isArray(ext.recurringThemes)) {
      allThemes.push(...ext.recurringThemes);
    }
  }

  // Deduplicate evidence items by messageId, keeping the higher importance item
  const evidenceByMsgId = new Map();
  for (const ev of allEvidence) {
    if (!ev.messageId) continue;
    const existing = evidenceByMsgId.get(ev.messageId);
    if (!existing || (ev.importance || 0) > (existing.importance || 0)) {
      evidenceByMsgId.set(ev.messageId, ev);
    }
  }

  const uniqueEvidence = Array.from(evidenceByMsgId.values())
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, 30); // Max 30 consolidated items per merged logical chunk

  const uniqueTopics = [...new Set(allTopics)].slice(0, 20);
  const uniqueThemes = [...new Set(allThemes)].slice(0, 15);

  return {
    period: {
      start: logicalChunk.startAt || '',
      end: logicalChunk.endAt || '',
    },
    topics: uniqueTopics,
    recurringThemes: uniqueThemes,
    evidence: uniqueEvidence,
  };
}

// ─── Helpers: Legacy Intelligence Mapping ─────────────────────────────────────

function buildParticipantStats(participants, allMessages, metadata) {
  const normal = allMessages.filter((m) => m.type === 'message' && m.sender);
  const total = normal.length || 1;
  const counts = {};
  for (const p of participants) counts[p] = 0;
  for (const m of normal) {
    if (counts[m.sender] !== undefined) counts[m.sender]++;
    else counts[m.sender] = 1;
  }
  return participants.map((p) => ({
    name: p,
    messageCount: counts[p] || 0,
    percentage: Math.round(((counts[p] || 0) / total) * 100),
  }));
}

function safeArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') return Object.values(val);
  return [];
}

function mapInvestigatorToLegacyIntelligence(investigatorResult, extractionMeta, evidenceStore, conversationMemory = null) {
  const inv = investigatorResult || {};
  const eras = safeArray(inv.eras);
  const participantProfiles = safeArray(inv.participantProfiles);
  const patterns = safeArray(inv.patterns);
  const lore = safeArray(inv.lore);
  const plotTwists = safeArray(inv.plotTwists);
  const keyThemes = safeArray(inv.keyThemes);
  const overarchingStory = inv.overarchingStory || {};

  const dominantThemes = keyThemes.length > 0 ? keyThemes : ['Conversational connection', 'Shared dynamics'];
  const overallTone = overarchingStory.overallDynamic || 'Conversational and grounded';

  const potentialStoryArcs = [
    overarchingStory.opening && `Opening: ${overarchingStory.opening}`,
    overarchingStory.development && `Evolution: ${overarchingStory.development}`,
    overarchingStory.escalation && `Peak moment: ${overarchingStory.escalation}`,
    overarchingStory.currentState && `Present state: ${overarchingStory.currentState}`,
  ].filter(Boolean);

  const recurringJokes = lore.map((l) => `${l.name || ''}: ${l.origin || ''}`).filter(Boolean).slice(0, 8);

  function stripMsgIds(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\[\s*msg_\d+\s*\]/gi, '')
      .replace(/\(\s*msg_\d+\s*\)/gi, '')
      .replace(/\bmsg_\d+\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  const mappedEras = eras.map((e, idx) => ({
    id: e.id || `era_${idx + 1}`,
    title: stripMsgIds(e.title) || `Phase ${idx + 1}`,
    startAt: e.startDate || '',
    endAt: e.endDate || '',
    summary: stripMsgIds(e.summary) || '',
    dominantTopics: safeArray(e.dominantTopics).map(stripMsgIds),
    tone: e.tone || 'Dynamic',
    importance: 0.85,
    evidenceMessageIds: safeArray(e.evidence).map((ev) => (typeof ev === 'string' ? ev : ev?.messageId)).filter(Boolean),
  }));

  const mappedCharacters = participantProfiles.map((p) => {
    const behaviorItems = safeArray(p.observedBehavior)
      .map((b) => (typeof b === 'string' ? b : b?.observation || b?.claim || ''))
      .filter(Boolean);
    const selfImageItems = safeArray(p.selfImage)
      .map((s) => (typeof s === 'string' ? s : s?.claim || ''))
      .filter(Boolean);
    const habits = safeArray(p.recurringHabits).map(stripMsgIds).filter(Boolean);

    let desc = behaviorItems.map(stripMsgIds).join('. ');
    if (!desc && selfImageItems.length > 0) {
      desc = `Claims: "${selfImageItems.map(stripMsgIds).join('; ')}". Signature communication style: ${p.communicationStyle || 'Frequent chatter'}.`;
    }
    if (!desc && habits.length > 0) {
      desc = `Signature texting habits: ${habits.join(', ')}. Known for distinctive rhythm throughout the archive.`;
    }
    if (!desc) {
      desc = `${p.communicationStyle || 'Active Communicator'}. Known for rapid-fire banter, distinctive texting rhythm, and memorable timing across the archive.`;
    }

    return {
      participant: stripMsgIds(p.participant) || 'Participant',
      title: stripMsgIds(p.communicationStyle) || 'Active Communicator',
      description: desc,
      observableTraits: [
        p.communicationStyle,
        p.humorStyle,
        p.emotionalStyle,
        p.conflictRole,
        ...habits,
      ].filter(Boolean).map(stripMsgIds).slice(0, 6),
      confidence: 0.9,
      evidenceMessageIds: safeArray(p.observedBehavior).flatMap((b) => safeArray(b?.evidence).map((ev) => (typeof ev === 'string' ? ev : ev?.messageId))).filter(Boolean),
    };
  });

  const mappedPatterns = patterns.map((pat, idx) => ({
    id: pat.id || `pat_${idx + 1}`,
    title: stripMsgIds(pat.pattern) || `Pattern ${idx + 1}`,
    description: stripMsgIds(pat.explanation) || '',
    frequency: 1,
    importance: pat.confidence || 0.85,
    evidenceMessageIds: safeArray(pat.evidence).map((ev) => (typeof ev === 'string' ? ev : ev?.messageId)).filter(Boolean),
  }));

  const mappedLore = lore.map((l, idx) => ({
    id: l.id || `lore_${idx + 1}`,
    title: stripMsgIds(l.name) || `Lore ${idx + 1}`,
    description: stripMsgIds([l.origin, l.howItEvolved].filter(Boolean).join(' — ')) || 'Shared inside joke',
    date: '',
    participants: [],
    funnyScore: 0.88,
    importance: 0.85,
    evidenceMessageIds: safeArray(l.evidence).map((ev) => (typeof ev === 'string' ? ev : ev?.messageId)).filter(Boolean),
  }));

  let mappedPlotTwists = plotTwists.map((pt, idx) => ({
    id: pt.id || `twist_${idx + 1}`,
    title: stripMsgIds(pt.title) || `Turning Point ${idx + 1}`,
    description: stripMsgIds(pt.description) || '',
    beforePeriod: pt.beforeContext || '',
    afterPeriod: pt.afterContext || '',
    significance: pt.significance || 0.85,
    evidenceMessageIds: safeArray(pt.evidence).map((ev) => (typeof ev === 'string' ? ev : ev?.messageId)).filter(Boolean),
  }));

  if (mappedPlotTwists.length === 0 && safeArray(inv.turningPoints).length > 0) {
    mappedPlotTwists = safeArray(inv.turningPoints).map((tp, idx) => ({
      id: `twist_${idx + 1}`,
      title: stripMsgIds(tp.title) || `Plot Twist ${idx + 1}`,
      description: stripMsgIds(tp.description) || 'A major shift in tone, topics, and messaging velocity.',
      beforePeriod: 'Early Phase',
      afterPeriod: 'Late Phase',
      significance: tp.significance || 0.88,
      evidenceMessageIds: safeArray(tp.evidence).map((ev) => (typeof ev === 'string' ? ev : ev?.messageId)).filter(Boolean),
    }));
  }

  if (mappedPlotTwists.length === 0 && mappedEras.length >= 2) {
    mappedPlotTwists = [
      {
        id: 'twist_1',
        title: 'The Great Dynamic Shift',
        description: `Transition from ${mappedEras[0].title} into ${mappedEras[1].title}, marking a fundamental shift in texting habits and conversational priorities.`,
        beforePeriod: mappedEras[0].startAt || 'Opening Phase',
        afterPeriod: mappedEras[1].startAt || 'Evolved Phase',
        significance: 0.9,
        evidenceMessageIds: mappedEras[0].evidenceMessageIds.slice(0, 2),
      },
    ];
  }

  return {
    overview: {
      dominantThemes: dominantThemes.map(stripMsgIds),
      overallTone: stripMsgIds(overallTone),
      potentialStoryArcs: potentialStoryArcs.map(stripMsgIds),
      recurringJokes: recurringJokes.map(stripMsgIds),
    },
    eras: mappedEras,
    characters: mappedCharacters,
    patterns: mappedPatterns,
    lore: mappedLore,
    plotTwists: mappedPlotTwists,
    _evidenceStore: evidenceStore,
    _rawInvestigator: investigatorResult,
    _conversationMemory: conversationMemory,
    _meta: extractionMeta,
  };
}

function buildFallbackInvestigatorResult(metadata, compactMemory, evidenceStore) {
  const participants = metadata.participants || ['Participant A', 'Participant B'];
  return {
    eras: (compactMemory?.periods || []).map((p, i) => ({
      id: `era_${i + 1}`,
      title: `Conversation Phase ${i + 1}`,
      startDate: p.dateRange?.split(' -> ')?.[0] || '',
      endDate: p.dateRange?.split(' -> ')?.[1] || '',
      summary: (p.topics || []).join(', ') || 'Conversational interaction',
      dominantTopics: p.topics || [],
      tone: 'Dynamic',
      majorChanges: [],
      evidence: [],
    })),
    participantProfiles: participants.map((p) => ({
      participant: p,
      communicationStyle: 'Engaged communicator',
      selfImage: [],
      observedBehavior: [],
      recurringHabits: [],
    })),
    patterns: [],
    contradictions: [],
    callbacks: [],
    foreshadowing: [],
    lore: [],
    funnyMoments: [],
    turningPoints: [],
    plotTwists: [],
    receiptCandidates: evidenceStore.slice(0, 10).map((ev) => ({
      reason: ev.connection || 'Extracted receipt',
      messageId: ev.messageId,
      sender: ev.sender,
      timestamp: ev.timestamp,
      exactText: ev.text,
      importance: ev.importance,
    })),
    unresolvedThreads: [],
    overarchingStory: {
      overallDynamic: 'Conversational Dynamic',
    },
    keyThemes: ['Shared history', 'Direct communication'],
  };
}
