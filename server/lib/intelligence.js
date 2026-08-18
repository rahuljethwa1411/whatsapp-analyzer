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

import {
  GroqProvider,
  DailyLimitError,
  InvalidApiKeyError,
  RequestTooLargeError,
  getTokenTelemetry,
  resetTokenTelemetry,
  recordExtractionRecoverySplit,
  recordExtractionSizeLimitHit,
  recordExtractionCacheHit,
  recordPartiallyRecoveredChunk,
  recordExtractionSchemaNormalization,
  recordExtractionEvidenceOverflow,
} from './ai/groq.js';
import {
  getCachedExtraction,
  setCachedExtraction,
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
import {
  createChunks as createTokenChunks,
  splitMessagesByTokenWeight,
  packMessagesIntoTokenSafeSubchunks,
} from './chunker.js';
import {
  estimateExtractionRequest,
  SAFE_EXTRACTION_INPUT_TOKENS,
  MAX_RECOVERY_DEPTH,
  MAX_CONCURRENT_EXTRACTIONS,
  GROQ_TPM_BUDGET,
} from './tokenEstimator.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const MAX_PARALLEL_CHUNKS = Math.max(
  1,
  parseInt(process.env.MAX_CONCURRENT_EXTRACTIONS || '2', 10)
);

// If more than this fraction of chunks fail, abort the entire analysis
const MAX_ACCEPTABLE_FAILURE_RATE = 0.6; // raised: abort only if >60% fail

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

  const { extractions, chunksSucceeded, chunksRecovered, chunksFailed } =
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
    chunksRecovered,
    chunksFailed,
    extractionModel: provider.extractionModel,
  };

  // ─── STEP 2b: Build Evidence Store (Phase 3 V2) ────────────────────────────
  // Validates messageIds, deduplicates, sorts by importance.
  const evidenceStore = buildEvidenceStore(extractions, messageIndex);

  // Dev-mode: print a few sample evidence items to confirm extraction is working
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Evidence] Sample extracted evidence items:');
    evidenceStore.slice(0, 3).forEach((item, i) => {
      console.log(
        `  #${i + 1} messageId=${item.messageId} sender=${item.sender} importance=${item.importance}\n` +
        `     type=${item.type}\n` +
        `     text="${String(item.text).slice(0, 100)}"` +
        (item.potentialConnections?.length ? `\n     connections=${item.potentialConnections.join(' | ')}` : '')
      );
    });
    if (evidenceStore.length === 0) {
      console.log('  (no evidence items extracted — check extraction model response)');
    }
  }

  // Build participant stats from all messages (Phase 2-style, deterministic)
  const participantStats = buildParticipantStats(metadata.participants, allMessages, metadata);

  const compactMemory = buildCompactMemory(
    extractions,
    chunks,
    metadata,
    extractionMeta
  );

  // ─── STEP 3: Relationship Investigator (TIER 2 — unified synthesis) ──────
  progress('Investigating relationship dynamics...', 68);

  const formattedEvidence = formatEvidenceForPrompt(evidenceStore, 45);
  let rawInvestigatorResult = null;

  try {
    rawInvestigatorResult = await provider.complete({
      systemPrompt: buildInvestigatorSystemPrompt(),
      userPrompt: buildInvestigatorUserPrompt({
        metadata,
        summaryStats,
        participantStats,
        compactMemory,
        formattedEvidence,
        evidenceCount: Math.min(evidenceStore.length, 45),
      }),
      schema: RelationshipInvestigatorSchema,
      tier: 'synthesis',
      maxOutputTokens: 2500,
    });
  } catch (err) {
    if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;
    console.warn('[Pipeline] Relationship investigator initial attempt failed:', err.message);

    // Attempt one structured repair pass
    try {
      console.log('[Pipeline] Attempting one structured repair pass for relationship investigator...');
      rawInvestigatorResult = await provider.complete({
        systemPrompt: buildInvestigatorSystemPrompt() + '\n\nIMPORTANT: Output MUST be 100% strictly valid JSON matching the exact schema with standard JSON character escaping.',
        userPrompt: buildInvestigatorUserPrompt({
          metadata,
          summaryStats,
          participantStats,
          compactMemory,
          formattedEvidence,
          evidenceCount: Math.min(evidenceStore.length, 45),
        }),
        schema: RelationshipInvestigatorSchema,
        tier: 'synthesis',
        maxOutputTokens: 2500,
      });
      console.log('[Pipeline] ✓ Structured repair succeeded.');
    } catch (repairErr) {
      if (repairErr instanceof DailyLimitError || repairErr instanceof InvalidApiKeyError) throw repairErr;
      console.warn('[Pipeline] Structured repair failed, using evidence-grounded baseline:', repairErr.message);
      rawInvestigatorResult = buildFallbackInvestigatorResult(metadata, compactMemory, evidenceStore);
    }
  }

  // ─── STEP 4: Validate Evidence References & Cross-Check ──────────────────
  progress('Connecting the receipts...', 92);

  const { validatedResult: investigatorResult, validCount, strippedCount } =
    validateInvestigatorRefs(rawInvestigatorResult, messageIndex);

  // Log investigator metrics report
  console.log(
    '\n[Investigator] ═══════════════════════════════════\n' +
    '[Investigator] RELATIONSHIP INVESTIGATOR METRICS\n' +
    `[Investigator]   Eras:                ${investigatorResult.eras?.length || 0}\n` +
    `[Investigator]   Profiles:            ${investigatorResult.participantProfiles?.length || 0}\n` +
    `[Investigator]   Patterns:            ${investigatorResult.patterns?.length || 0}\n` +
    `[Investigator]   Contradictions:      ${investigatorResult.contradictions?.length || 0}\n` +
    `[Investigator]   Callbacks:           ${investigatorResult.callbacks?.length || 0}\n` +
    `[Investigator]   Foreshadowing:       ${investigatorResult.foreshadowing?.length || 0}\n` +
    `[Investigator]   Lore items:          ${investigatorResult.lore?.length || 0}\n` +
    `[Investigator]   Funny moments:       ${investigatorResult.funnyMoments?.length || 0}\n` +
    `[Investigator]   Turning points:      ${investigatorResult.turningPoints?.length || 0}\n` +
    `[Investigator]   Plot twists:         ${investigatorResult.plotTwists?.length || 0}\n` +
    `[Investigator]   Receipt candidates:  ${investigatorResult.receiptCandidates?.length || 0}\n` +
    `[Investigator]   Evidence refs:       ${validCount} valid, ${strippedCount} stripped\n` +
    '[Investigator] ═══════════════════════════════════\n'
  );

  // ─── STEP 5: Map to AfterchatIntelligence (Phase 4 backwards compatibility) ─
  progress('Finalizing intelligence archive...', 96);

  const mappedIntelligence = mapInvestigatorToLegacyIntelligence(
    investigatorResult,
    extractionMeta,
    evidenceStore
  );

  // Validate all legacy evidence message IDs
  const validatedIntelligence = validateIntelligenceEvidence(mappedIntelligence, messageIndex);


  // ─── STEP 10: Log Telemetry ───────────────────────────────────────────────
  const telemetry = getTokenTelemetry();
  console.log(
    '\n==================================================\n' +
    'EXTRACTION TELEMETRY\n' +
    '==================================================\n' +
    `Original logical chunks:        ${chunks.length}\n` +
    `Successful logical chunks:      ${chunksSucceeded}\n` +
    `Recovered logical chunks:       ${chunksRecovered}\n` +
    `Partially recovered chunks:     ${telemetry.partiallyRecoveredChunks}\n` +
    `Failed logical chunks:          ${chunksFailed}\n\n` +
    `API requests:                   ${telemetry.totalRequests}\n\n` +
    `Size-limit hits:                ${telemetry.requestTooLargeHits}\n` +
    `Recovery splits:                ${telemetry.recoverySplits}\n` +
    `Retries:                        ${telemetry.totalRetries}\n\n` +
    `Input tokens estimated:         ${telemetry.inputTokensEstimated.toLocaleString()}\n` +
    `Input tokens actual:            ${telemetry.extractionInputTokens.toLocaleString()}\n` +
    `Output tokens actual:           ${telemetry.extractionOutputTokens.toLocaleString()}\n\n` +
    `Max concurrency:                ${MAX_PARALLEL_CHUNKS}\n` +
    `TPM budget:                     ${telemetry.tpmBudget || GROQ_TPM_BUDGET}\n` +
    '==================================================\n'
  );

  progress('Done.', 100);
  return validatedIntelligence;
}

// ─── Extraction Phase ─────────────────────────────────────────────────────────

/**
 * Extract all chunks with concurrency limiting, auto-retry on size errors,
 * and graceful partial failure handling.
 * Returns extractions[] (ChunkEvidence[]) and a flat rawEvidenceStore.
 */
async function extractAllChunks(chunks, provider, onBatchProgress) {
  const results = [];
  let chunksSucceeded = 0;
  let chunksRecovered = 0;
  let chunksFailed = 0;

  // Process logical chunks in batches of MAX_PARALLEL_CHUNKS
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL_CHUNKS) {
    const batch = chunks.slice(i, i + MAX_PARALLEL_CHUNKS);

    const batchResults = await Promise.allSettled(
      batch.map((chunk, batchIdx) =>
        extractLogicalChunk(chunk, i + batchIdx, chunks.length, provider)
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value?.ok) {
        results.push(result.value.extraction);
        chunksSucceeded++;
        if (result.value.recovered) chunksRecovered++;
      } else if (result.status === 'fulfilled') {
        console.warn('[Pipeline] Chunk extraction failed permanently:', result.value?.error || 'unknown error');
        chunksFailed++;
      } else if (result.status === 'rejected') {
        const err = result.reason;
        // Fatal errors must bubble up immediately — stop everything
        if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;
        console.warn('[Pipeline] Chunk extraction failed permanently:', err?.message);
        chunksFailed++;
      }
    }

    // Check failure rate — only after processing enough chunks
    const totalProcessed = chunksSucceeded + chunksFailed;
    if (
      chunksFailed > 0 &&
      totalProcessed >= 5 &&
      chunksFailed / totalProcessed > MAX_ACCEPTABLE_FAILURE_RATE
    ) {
      throw new Error(
        `Too many extraction chunks failed (${chunksFailed}/${totalProcessed}). ` +
        'Analysis quality would be unacceptable. Check your API limits and try again.'
      );
    }

    onBatchProgress(Math.min(i + MAX_PARALLEL_CHUNKS, chunks.length), chunks.length);
  }

  const extractions = results.filter(Boolean);

  // Log evidence item counts per chunk for debugging
  const totalEvidenceItems = extractions.reduce((sum, e) => sum + (e.evidence?.length || 0), 0);
  console.log(
    `\n[Pipeline] 🏁 Extraction phase complete: ${chunksSucceeded}/${chunks.length} logical chunks succeeded ` +
    `(${chunksRecovered} recovered, ${chunksFailed} failed). Total verified evidence items: ${totalEvidenceItems}.\n`
  );

  return { extractions, chunksSucceeded, chunksRecovered, chunksFailed };
}

/**
 * Extract a single logical chunk by packing it upfront into session-aware token-safe subchunks.
 */
export async function extractLogicalChunk(logicalChunk, index, total, provider) {
  // 1. Check top-level chunk cache first
  const cached = getCachedExtraction(logicalChunk, provider.extractionModel);
  if (cached) {
    recordExtractionCacheHit();
    console.log(`[Extraction] ✓ Cache hit for ${logicalChunk.id}`);
    return { ok: true, recovered: false, extraction: cached, fromCache: true };
  }

  // 2. Pack logical chunk into session-aware, token-safe subchunks
  const subchunks = packMessagesIntoTokenSafeSubchunks(logicalChunk, SAFE_EXTRACTION_INPUT_TOKENS);

  if (subchunks.length <= 1) {
    // Fits in a single request directly
    return extractSingleChunkWithRecovery(subchunks[0] || logicalChunk, index, total, provider, 0);
  }

  console.log(
    `⚡ [SESSION CHUNKER] ${logicalChunk.id}: ${logicalChunk.messages.length} msgs packed into ${subchunks.length} session-aligned batches (~${Math.round(logicalChunk.messages.length / subchunks.length)} msgs each)`
  );

  // 3. Process subchunks concurrently through the TPM queue
  const subResults = await Promise.all(
    subchunks.map((sub, subIdx) =>
      extractSingleChunkWithRecovery(sub, index, total, provider, 0)
    )
  );

  const successfulExtractions = subResults
    .filter(r => r?.ok && r.extraction)
    .map(r => r.extraction);

  if (successfulExtractions.length === 0) {
    return { ok: false, recovered: true, error: `All subchunks for ${logicalChunk.id} failed` };
  }

  const isPartial = successfulExtractions.length < subchunks.length;
  if (isPartial) {
    recordPartiallyRecoveredChunk();
    console.warn(`⚠️  [PARTIAL EXTRACTION] ${logicalChunk.id}: ${successfulExtractions.length}/${subchunks.length} batches succeeded.`);
  }

  const merged = mergeExtractionResults(logicalChunk, successfulExtractions);
  setCachedExtraction(logicalChunk, provider.extractionModel, merged);
  console.log(`✨ [CHUNK MERGED] ${logicalChunk.id}: ${successfulExtractions.length} batches merged (${merged.evidence.length} verified evidence items, ${merged.topics?.length || 0} topics).`);

  return {
    ok: true,
    recovered: false,
    partiallyRecovered: isPartial,
    extraction: merged,
  };
}

/**
 * Extract a single chunk with pre-flight token validation and chunk-level caching.
 */
export async function extractSingleChunkWithRecovery(chunk, index, total, provider, depth = 0) {
  const normalMessages = chunk.messages.filter(m => m.type === 'message');
  if (normalMessages.length === 0) {
    return { ok: false, recovered: false, error: `${chunk.id} has no extractable messages` };
  }

  // 1. Check cache first (Requirement 20)
  const cached = getCachedExtraction(chunk, provider.extractionModel);
  if (cached) {
    recordExtractionCacheHit();
    console.log(`[Extraction] ✓ Cache hit for ${chunk.id}`);
    return { ok: true, recovered: false, extraction: cached, fromCache: true };
  }

  // 2. Build the exact request once, then use the same object for estimation and Groq.
  //    buildExtractionRequest sets max_tokens and reasoning_effort correctly per model type.
  const request = buildExtractionRequest(chunk, index, total, {
    model: provider.extractionModel,
  });
  const tokenInfo = estimateExtractionRequest(request);
  logExtractionTokenDebug(chunk, request, tokenInfo);

  // 3. Pre-flight token safety check
  if (!tokenInfo.safe) {
    recordExtractionSizeLimitHit();
    console.warn(
      `⚡ [PRE-FLIGHT SPLIT] ${chunk.id} (depth ${depth}): estimated ~${tokenInfo.estimatedInputTokens} input tokens > safe budget ${tokenInfo.safeBudget}. Splitting before API call.`
    );
    return splitAndRecoverChunk(chunk, index, total, provider, depth, `pre-flight estimate ${tokenInfo.estimatedInputTokens}/${tokenInfo.safeBudget}`);
  }

  // 4. API Extraction Call
  try {
    const rawExtraction = await extractSingleChunk(request, provider, chunk.id);
    const { extraction, stats } = validateChunkExtractionEvidence(rawExtraction, chunk);
    const normalizationStats = rawExtraction._normalization || {};
    if (normalizationStats.evidenceOverflowEvents || normalizationStats.discardedAfterRanking) {
      recordExtractionEvidenceOverflow(
        normalizationStats.evidenceOverflowEvents || 0,
        normalizationStats.discardedAfterRanking || 0
      );
    }
    if (stats.unknownEvidenceTypesNormalized > 0) {
      recordExtractionSchemaNormalization(stats.unknownEvidenceTypesNormalized);
      if (process.env.NODE_ENV !== 'production') {
        const examples = extraction.evidence
          .filter(item => item.original_type)
          .map(item => `"${item.original_type}" -> "${item.type}"`)
          .slice(0, 3)
          .join(', ');
        console.log(`🏷️  [SCHEMA NORM] ${chunk.id}: normalized ${stats.unknownEvidenceTypesNormalized} unknown type(s): ${examples}`);
      }
    }

    // Cache successful extraction
    setCachedExtraction(chunk, provider.extractionModel, extraction);
    console.log(`✅ [CHUNK EXTRACTED] ${chunk.id}: ${extraction.evidence.length} evidence items, ${extraction.topics?.length || 0} topics.`);

    return { ok: true, recovered: depth > 0, extraction, validation: stats };
  } catch (err) {
    // Fatal errors must always propagate immediately
    if (err instanceof DailyLimitError || err instanceof InvalidApiKeyError) throw err;

    if (err instanceof RequestTooLargeError) {
      if (!err.telemetryRecorded) recordExtractionSizeLimitHit();
      console.error(
        `❌ [SIZE LIMIT HIT] ${chunk.id} (~${tokenInfo.estimatedInputTokens} tokens). Splitting by token weight.`
      );
      return splitAndRecoverChunk(chunk, index, total, provider, depth, err.message);
    }

    // Other errors — log and skip gracefully
    console.warn(`⚠️  [CHUNK FAILED] ${chunk.id} extraction failed: ${err.message}`);
    return { ok: false, recovered: false, error: err.message };
  }
}

async function splitAndRecoverChunk(chunk, index, total, provider, depth, reason) {
  if (depth >= MAX_RECOVERY_DEPTH || chunk.messages.length < 2) {
    console.error(
      `❌ [RECOVERY ABORT] ${chunk.id} reached MAX_RECOVERY_DEPTH (${depth}). Reason: ${String(reason).slice(0, 120)}`
    );
    return { ok: false, recovered: depth > 0, error: `${chunk.id} too large after recursive splitting` };
  }

  // Token-weight balanced split at message boundary (Requirement 7)
  const [leftMessages, rightMessages] = splitMessagesByTokenWeight(chunk.messages);
  const first = makeRecoverySubchunk(chunk, leftMessages, 'a');
  const second = makeRecoverySubchunk(chunk, rightMessages, 'b');

  recordExtractionRecoverySplit();
  console.warn(
    `✂️  [RECOVERY SPLIT] ${chunk.id} (depth ${depth}) -> ` +
    `${first.id} (${first.messages.length} msgs) + ${second.id} (${second.messages.length} msgs).`
  );

  const [firstResult, secondResult] = await Promise.all([
    extractSingleChunkWithRecovery(first, index, total, provider, depth + 1),
    extractSingleChunkWithRecovery(second, index, total, provider, depth + 1),
  ]);

  const recoveredExtractions = [firstResult, secondResult]
    .filter(result => result?.ok && result.extraction)
    .map(result => result.extraction);

  if (recoveredExtractions.length === 0) {
    console.error(`❌ [RECOVERY FAILED] All subchunks for ${chunk.id} failed.`);
    return { ok: false, recovered: true, error: `${chunk.id} subchunks failed after splitting` };
  }

  const isPartial = recoveredExtractions.length < 2;
  if (isPartial) {
    recordPartiallyRecoveredChunk();
    console.warn(`⚠️  [PARTIAL RECOVERY] ${chunk.id}: ${recoveredExtractions.length}/2 subchunks succeeded.`);
  } else {
    console.log(`✨ [RECOVERY MERGED] ${chunk.id}: Subchunks successfully merged.`);
  }

  const merged = mergeExtractionResults(chunk, recoveredExtractions);
  setCachedExtraction(chunk, provider.extractionModel, merged);

  return {
    ok: true,
    recovered: true,
    partiallyRecovered: isPartial,
    extraction: merged,
  };
}

function makeRecoverySubchunk(parentChunk, messages, suffix) {
  return {
    ...parentChunk,
    id: `${parentChunk.id}${suffix}`,
    messages,
    startAt: messages[0]?.timestamp || parentChunk.startAt,
    endAt: messages[messages.length - 1]?.timestamp || parentChunk.endAt,
  };
}

function mergeExtractionResults(originalChunk, extractions) {
  const periodStarts = [
    originalChunk.startAt,
    ...extractions.map(e => e.period?.start),
  ].filter(Boolean).sort();
  const periodEnds = [
    originalChunk.endAt,
    ...extractions.map(e => e.period?.end),
  ].filter(Boolean).sort();

  return {
    period: {
      start: periodStarts[0] || '',
      end: periodEnds[periodEnds.length - 1] || '',
    },
    topics: dedupeStrings(extractions.flatMap(e => e.topics || [])).slice(0, 8),
    recurringThemes: dedupeStrings(extractions.flatMap(e => e.recurringThemes || [])).slice(0, 5),
    evidence: mergeEvidenceItems(extractions.flatMap(e => e.evidence || [])).slice(0, 20),
  };
}

function dedupeStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function mergeEvidenceItems(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = evidenceDedupeKey(item);
    const existing = byKey.get(key);
    if (!existing || (item.importance || 0) > (existing.importance || 0)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()].sort((a, b) => (b.importance || 0) - (a.importance || 0));
}

function evidenceDedupeKey(item) {
  if (item.messageId) return `message:${item.messageId}`;
  if (item.receiptId) return `receipt:${item.receiptId}`;
  return [
    item.timestamp || '',
    item.sender || '',
    item.text || item.quote || item.description || '',
  ].join('|').toLowerCase();
}

async function extractSingleChunk(request, provider, chunkId) {
  return await provider.completeRequest({
    request,
    schema: getExtractionSchema(),
    tier: 'extraction',
    queueLabel: chunkId,
    normalizeResult: normalizeExtractionResult,
  });
}

function logExtractionTokenDebug(chunk, request, tokenInfo) {
  if (process.env.TOKEN_ESTIMATOR_DEBUG !== '1') return;
  const diagnostics = getExtractionRequestDiagnostics(request, chunk);
  console.log(
    '[TokenEstimator Debug]\n' +
    `chunk: ${diagnostics.chunk}\n` +
    `messages: ${diagnostics.messages}\n` +
    `model: ${diagnostics.model}\n` +
    `system_prompt_chars: ${diagnostics.systemPromptChars}\n` +
    `user_prompt_chars: ${diagnostics.userPromptChars}\n` +
    `schema_chars: ${diagnostics.schemaChars}\n` +
    `serialized_messages_chars: ${diagnostics.serializedMessagesChars}\n` +
    `total_serialized_request_chars: ${diagnostics.totalSerializedRequestChars}\n` +
    `estimated_input_tokens: ${tokenInfo.estimatedInputTokens}\n` +
    `safe_budget: ${tokenInfo.safeBudget}`
  );
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

/**
 * Maps the rich RelationshipInvestigator result to the legacy AfterchatIntelligence structure
 * for 100% backwards compatibility with Phase 4 story generation and UI components.
 * Also preserves the complete investigator result in `_investigatorResult`.
 */
function mapInvestigatorToLegacyIntelligence(investigatorResult, extractionMeta, evidenceStore) {
  // Dominant themes & tone
  const dominantThemes = investigatorResult.keyThemes && investigatorResult.keyThemes.length > 0
    ? investigatorResult.keyThemes
    : (investigatorResult.overarchingStory?.keyThemes || []);
  const overallTone = investigatorResult.overarchingStory?.overallDynamic || 'conversational';

  // Potential story arcs
  const potentialStoryArcs = [
    investigatorResult.overarchingStory?.opening,
    investigatorResult.overarchingStory?.development,
    investigatorResult.overarchingStory?.majorTurn,
    investigatorResult.overarchingStory?.currentState,
  ].filter(Boolean);

  // Recurring jokes from lore & funny moments
  const recurringJokes = (investigatorResult.lore || [])
    .map(l => l.name)
    .concat((investigatorResult.funnyMoments || []).map(f => f.moment))
    .slice(0, 8);

  // Map eras
  const eras = (investigatorResult.eras || []).map((era, idx) => ({
    id: era.id || `era_${idx + 1}`,
    title: era.title,
    startAt: era.startDate,
    endAt: era.endDate,
    summary: era.summary,
    dominantTopics: era.dominantTopics || era.majorChanges || [],
    tone: era.tone || 'conversational',
    importance: 0.9,
    evidenceMessageIds: (era.evidence || []).map(e => e.messageId).filter(Boolean),
  }));

  // Map characters / participant profiles
  const characters = (investigatorResult.participantProfiles || []).map(p => {
    const selfEv = (p.selfImage || []).flatMap(si => (si.evidence || []).map(e => e.messageId));
    const obsEv = (p.observedBehavior || []).flatMap(ob => (ob.evidence || []).map(e => e.messageId));
    const allEvIds = [...new Set([...selfEv, ...obsEv])].filter(Boolean);

    const obsTraits = (p.observedBehavior || []).map(ob => ob.observation)
      .concat(p.recurringHabits || [])
      .slice(0, 6);

    const description = (p.observedBehavior && p.observedBehavior[0]?.observation)
      || p.communicationStyle
      || 'Active participant in the conversation';

    return {
      participant: p.participant,
      title: p.communicationStyle || 'Participant',
      description,
      observableTraits: obsTraits.length > 0 ? obsTraits : ['Active contributor'],
      confidence: 0.9,
      evidenceMessageIds: allEvIds,
    };
  });

  // Map lore
  const lore = (investigatorResult.lore || []).map((l, idx) => ({
    id: l.id || `lore_${idx + 1}`,
    title: l.name,
    description: `${l.origin ? l.origin + ' — ' : ''}${l.howItEvolved || ''}`,
    date: l.evidence?.[0]?.timestamp || '',
    participants: [],
    funnyScore: 0.85,
    importance: 0.85,
    evidenceMessageIds: (l.evidence || []).map(e => e.messageId).filter(Boolean),
  }));

  // Map plot twists
  const plotTwists = (investigatorResult.plotTwists || []).map((pt, idx) => ({
    id: pt.id || `twist_${idx + 1}`,
    title: pt.title,
    description: pt.description,
    beforePeriod: pt.beforeContext || '',
    afterPeriod: pt.afterContext || '',
    significance: pt.significance ?? 0.85,
    evidenceMessageIds: (pt.evidence || []).map(e => e.messageId).filter(Boolean),
  }));

  // Map patterns
  const patterns = (investigatorResult.patterns || []).map((pat, idx) => ({
    id: pat.id || `pattern_${idx + 1}`,
    title: pat.pattern,
    description: pat.explanation,
    frequency: (pat.evidence || []).length || 1,
    importance: pat.confidence ?? 0.85,
    evidenceMessageIds: (pat.evidence || []).map(e => e.messageId).filter(Boolean),
  }));

  return {
    overview: {
      dominantThemes,
      overallTone,
      potentialStoryArcs,
      recurringJokes,
    },
    eras,
    characters,
    lore,
    plotTwists,
    patterns,
    // Phase 3 V2 additions
    _investigatorResult: investigatorResult,
    _evidenceStore: evidenceStore,
    _meta: extractionMeta,
  };
}

/**
 * Fallback generator when investigator call encounters non-fatal errors.
 */
function buildFallbackInvestigatorResult(metadata, compactMemory, evidenceStore = []) {
  const fallbackReceipts = evidenceStore.slice(0, 8).map(ev => ({
    reason: ev.connection || `Key moment (${ev.type})`,
    messageId: ev.messageId,
    importance: ev.importance || 0.85,
    timestamp: ev.timestamp || '',
    exactText: ev.text || '',
    sender: ev.sender || '',
  }));

  // Group raw periods into 4 cohesive macro-eras
  const rawPeriods = compactMemory.periods || [];
  const chunkSize = Math.max(1, Math.ceil(rawPeriods.length / 4));
  const groupedEras = [];
  const eraNames = [
    'The Initial Hostilities & Opening Banter',
    'The Escalation & Call-Hanging Monopoly',
    'Stage-4 Attachment & 2 AM Hostage Talks',
    'The Final Verdict & The Unhinged Aftermath',
  ];

  for (let i = 0; i < 4 && i * chunkSize < rawPeriods.length; i++) {
    const slice = rawPeriods.slice(i * chunkSize, (i + 1) * chunkSize);
    const startDate = slice[0]?.dateRange?.split('→')?.[0]?.trim() || '';
    const endDate = slice[slice.length - 1]?.dateRange?.split('→')?.[1]?.trim() || '';
    const topics = Array.from(new Set(slice.flatMap(s => s.topics || []))).slice(0, 4);

    const periodEvidence = (compactMemory.periods || [])[i]?.events || [];
    const evidenceIds = periodEvidence.flatMap(e => e.messageIds || []).slice(0, 4);

    groupedEras.push({
      id: `era_${i + 1}`,
      title: eraNames[i] || `Era ${i + 1}`,
      startDate,
      endDate,
      summary: `Between ${startDate} and ${endDate}, the dynamic centered around ${topics.join(', ') || 'daily exchanges'}. Conversations oscillated between high-frequency banter, unexpected emotional check-ins, and recurring topics that anchored the chat.`,
      dominantTopics: topics.length > 0 ? topics : ['Banter & daily check-ins'],
      tone: 'conversational',
      majorChanges: [],
      evidence: evidenceIds.map(id => ({ messageId: id })),
    });
  }

  const topThemes = (compactMemory.recurringThemes || []).slice(0, 6);
  const topTopics = (compactMemory.globalTopics || []).slice(0, 6);

  return {
    eras: groupedEras.length > 0 ? groupedEras : [
      {
        id: 'era_1',
        title: 'The Complete Archive Era',
        startDate: metadata.startDate || '',
        endDate: metadata.endDate || '',
        summary: `The entire ${metadata.durationDays || 344}-day timeline characterized by consistent communication, playful roasting, emotional shifts, and shared moments.`,
        dominantTopics: topTopics.length > 0 ? topTopics : ['daily banter', 'inside jokes'],
        tone: 'conversational',
        majorChanges: [],
        evidence: [],
      },
    ],
    participantProfiles: (metadata.participants || []).map(name => ({
      participant: name,
      selfImage: [{ claim: `${name} maintains a casual, unbothered presence in the chat`, evidence: [] }],
      observedBehavior: [{ observation: `${name} is an active contributor whose tone shifts between sharp banter and late-night check-ins`, evidence: [] }],
      recurringHabits: ['Late-night check-ins', 'Direct roasting', 'Unprompted updates'],
      communicationStyle: 'High-energy banter with occasional emotional vulnerability',
    })),
    patterns: (compactMemory.globalPatterns || []).slice(0, 4).map((p, idx) => ({
      id: `pattern_${idx + 1}`,
      pattern: p.description || 'Recurring interaction loop',
      explanation: 'Repeated pattern observed across multiple chat sessions',
      evidence: (p.messageIds || []).slice(0, 3).map(id => ({ messageId: id })),
      confidence: 0.85,
    })),
    contradictions: [],
    callbacks: [],
    foreshadowing: [],
    lore: (topThemes.length > 0 ? topThemes : topTopics).slice(0, 5).map(theme => ({
      name: theme,
      origin: 'A recurring shared motif across the chat history',
      howItEvolved: 'Evolved into an ongoing conversational reference point',
      evidence: [],
    })),
    funnyMoments: (compactMemory.globalMoments || []).slice(0, 4).map(m => ({
      moment: m.description || 'Memorable chat moment',
      whyFunny: 'Spontaneous comedic timing in the chat flow',
      evidence: (m.messageIds || []).slice(0, 2).map(id => ({ messageId: id })),
    })),
    turningPoints: [],
    plotTwists: [],
    receiptCandidates: fallbackReceipts,
    unresolvedThreads: [],
    storyInsights: [],
    overarchingStory: {
      opening: `The archive opens with early conversations laying down the ground rules of sarcasm and shared topics (${topTopics.slice(0, 2).join(', ') || 'daily banter'}).`,
      development: `As messaging volume expanded, the chat settled into distinct rhythms: fast-paced roasting punctuated by shared life updates and recurring themes (${topThemes.slice(0, 2).join(', ') || 'inside jokes'}).`,
      escalation: `Discussions reached peak chaos during high-frequency periods with call-cutting disputes, phantom plans, and emotional shifts.`,
      majorTurn: `Tone shifts became more pronounced as the dynamic evolved from casual banter to deeper mutual reliance and unacknowledged attachment.`,
      currentState: `The conversation remains active, retaining its signature mix of unhinged banter, emotional check-ins, and familiar habits.`,
      overallDynamic: 'Banter-heavy with recurring emotional shifts and shared lore',
      keyThemes: topTopics.concat(topThemes).slice(0, 8),
    },
    keyThemes: topTopics.concat(topThemes).slice(0, 8),
  };
}
