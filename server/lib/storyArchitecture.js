/**
 * Story Architecture — Era-Aware 10-Chapter Planning Engine with Explicit Scene Boundaries
 *
 * After eras are detected, this module decides what the 10 chapters should be.
 *
 * Hard Architectural Rules (§Scene Boundaries & Non-Stitching):
 *   ✓ Chapters are planned AFTER eras are understood.
 *   ✓ Chapters contain explicit Scene objects with discrete interactionIds.
 *   ✓ If interaction A !== interaction B, they are SEPARATE scenes by default.
 *   ✓ Era is a temporal container, NOT a continuous scene.
 *   ✓ Thematic similarity does NOT merge interaction boundaries.
 *   ✓ Cross-era callbacks are prioritized and formatted with strict chronological separation.
 *   ✓ Relationship between scenes is explicitly declared: 'SEPARATE' | 'CONFIRMED_CALLBACK' | 'CONTRAST' | 'CHRONOLOGICAL_CONTINUATION'.
 */

// ── Types (JSDoc only, no TS) ────────────────────────────────────────────────

/**
 * @typedef {Object} Scene
 * @property {string} sceneId
 * @property {string} interactionId
 * @property {string[]} evidenceIds
 * @property {string} timestamp
 * @property {string} date
 * @property {string} startMessageId
 * @property {string} endMessageId
 * @property {string} context
 * @property {string} setup
 * @property {string} response
 * @property {string} outcome
 * @property {string} tone
 * @property {string} topic
 * @property {string[]} dialogue
 * @property {Array} messages
 * @property {'START' | 'SEPARATE' | 'CHRONOLOGICAL_CONTINUATION' | 'CONFIRMED_CALLBACK' | 'CONTRAST'} relationshipToPreviousScene
 * @property {'END' | 'SEPARATE' | 'CHRONOLOGICAL_CONTINUATION' | 'CONFIRMED_CALLBACK' | 'CONTRAST'} relationshipToNextScene
 * @property {string} whySelected
 */

/**
 * @typedef {Object} PlannedChapter
 * @property {number} chapterNumber
 * @property {string} title
 * @property {string} timeRange
 * @property {string[]} eraIds
 * @property {string} eraTitle
 * @property {string} centralIdea
 * @property {string} narrativeAngle
 * @property {string[]} evidenceIds
 * @property {string[]} interactionIds
 * @property {Scene[]} scenes
 * @property {'SEPARATE' | 'CONFIRMED_CALLBACK' | 'CONTRAST' | 'CHRONOLOGICAL_CONTINUATION'} relationshipBetweenScenes
 * @property {Object[]} highValueInteractions
 * @property {Object[]} relevantCallbacks
 * @property {Object[]} relevantContradictions
 * @property {Object[]} relevantPatterns
 * @property {string} whyThisChapterExists
 * @property {string} chapterType
 */

// ── Scene Builder Helper ─────────────────────────────────────────────────────

export function buildScenesFromInteractions(interactions = [], defaultRelationship = 'SEPARATE', whySelected = '') {
  return (interactions || []).map((h, idx) => {
    const interactionId = h.interactionId || h.evidenceId || `int_${idx + 1}`;
    const date = h.date || (h.startTimestamp ? h.startTimestamp.slice(0, 10) : '');
    const ts = h.startTimestamp || h.timestamp || date;

    return {
      sceneId: `scene_${idx + 1}`,
      interactionId,
      evidenceIds: [h.evidenceId || interactionId].filter(Boolean),
      timestamp: ts,
      date,
      startMessageId: h.startMessageId || (h.messages && h.messages[0]?.id) || '',
      endMessageId: h.endMessageId || (h.messages && h.messages[h.messages.length - 1]?.id) || '',
      context: h.context || h.summary || 'Conversational exchange',
      setup: h.setup || (h.dialogue && h.dialogue[0]) || '',
      response: h.response || (h.dialogue && h.dialogue[1]) || '',
      outcome: h.outcome || (h.dialogue && h.dialogue[h.dialogue.length - 1]) || '',
      tone: h.tone || 'conversational',
      topic: h.topic || 'conversational',
      dialogue: h.dialogue || [],
      messages: h.messages || [],
      relationshipToPreviousScene: idx === 0 ? 'START' : defaultRelationship,
      relationshipToNextScene: idx === interactions.length - 1 ? 'END' : defaultRelationship,
      whySelected: whySelected || h.whyItMatters || 'Grounded interaction from Story Memory',
    };
  });
}

// ── Era-Aware Chapter Planning ────────────────────────────────────────────────

/**
 * Builds a 10-chapter plan from Story Memory, distributing chapters by narrative value
 * and enforcing strict Scene object boundaries.
 *
 * @param {Object} storyMemory — Output of buildStoryMemory
 * @returns {{ chapters: PlannedChapter[], telemetry: Object }}
 */
export function buildChapterPlan(storyMemory) {
  const {
    conversationOverview: co = {},
    eras = [],
    eraTransitions = [],
    highValueInteractions = [],
    recurringPatterns = [],
    confirmedCallbacks = [],
    callbackCandidates = [],
    contradictions = [],
    rareMemorableMoments = [],
    turningPoints = [],
    recurringTopics = [],
    unresolvedThreads = [],
  } = storyMemory;

  const participants = (co.participants || []);
  const usedEvidenceIds = new Set();

  // ── 1. Score each era by narrative value ────────────────────────────────
  const scoredEras = eras.map(era => {
    const evCount = (era.keyEvidenceIds || []).length;
    const hasCallback = confirmedCallbacks.some(
      cb => (era.keyEvidenceIds || []).includes(cb.original?.evidenceId) ||
            (era.keyEvidenceIds || []).includes(cb.later?.evidenceId)
    );
    const hasRareMoment = rareMemorableMoments.some(r => (era.keyEvidenceIds || []).includes(r.evidenceId));
    const hasTurningPoint = turningPoints.some(tp => (era.keyEvidenceIds || []).includes(tp.evidenceId));
    const hasContradiction = contradictions.some(
      c => (era.keyEvidenceIds || []).includes(c.sideA?.evidenceId) ||
           (era.keyEvidenceIds || []).includes(c.sideB?.evidenceId)
    );

    const score =
      evCount * 1.0 +
      (hasCallback    ? 3.0 : 0) +
      (hasRareMoment  ? 2.5 : 0) +
      (hasTurningPoint? 2.0 : 0) +
      (hasContradiction? 1.5 : 0) +
      (era.confidence ?? 0.8) * 2.0;

    return { ...era, _narrativeScore: score, _hasCallback: hasCallback, _hasRareMoment: hasRareMoment };
  });

  // Sort by narrative score (highest first) for allocation
  const sortedByScore = [...scoredEras].sort((a, b) => b._narrativeScore - a._narrativeScore);

  // ── 2. Allocate initial chapter slots to eras (proportional) ────────────
  const TARGET_CHAPTERS = 10;
  let chaptersRemaining = TARGET_CHAPTERS;
  const eraSlots = new Map(); // eraId → chapter count

  // Cross-era callbacks get their own dedicated slot
  const crossEraCallbacks = confirmedCallbacks.filter(cb => {
    if (!cb.original?.evidenceId || !cb.later?.evidenceId) return false;
    const origEra = _findEraForEvidence(eras, cb.original.evidenceId);
    const laterEra = _findEraForEvidence(eras, cb.later.evidenceId);
    return origEra && laterEra && origEra.eraId !== laterEra.eraId;
  });
  const crossEraCallbackSlots = Math.min(crossEraCallbacks.length, 2);
  chaptersRemaining -= crossEraCallbackSlots;

  // Transitions worth a chapter (long gap or dramatic shift)
  const notableTransitions = eraTransitions.filter(t => t.gapDays >= 14 || (t.description && t.description.includes('different mode')));
  const transitionSlots = Math.min(notableTransitions.length, 1);
  chaptersRemaining -= transitionSlots;

  // Rare moments slot (if not already in a high-scoring era)
  const standaloneRareMoments = rareMemorableMoments.filter(r => {
    const era = _findEraForEvidence(eras, r.evidenceId);
    return !era || (scoredEras.find(e => e.eraId === era.eraId)?._narrativeScore || 0) < 5;
  });
  const rareMomentSlots = standaloneRareMoments.length > 0 ? 1 : 0;
  chaptersRemaining -= rareMomentSlots;

  // Reserve 1 slot for current state
  chaptersRemaining -= 1;

  // Distribute remaining slots to eras by score
  const totalScore = sortedByScore.reduce((s, e) => s + e._narrativeScore, 0);
  let distributedCount = 0;
  for (const era of sortedByScore) {
    if (distributedCount >= chaptersRemaining) break;
    const proportion = era._narrativeScore / Math.max(1, totalScore);
    const slots = Math.max(1, Math.round(proportion * chaptersRemaining));
    const capped = Math.min(slots, chaptersRemaining - distributedCount, 3); // max 3 chapters per era
    eraSlots.set(era.eraId, capped);
    distributedCount += capped;
  }

  // Fill any remaining gap
  if (distributedCount < chaptersRemaining) {
    const topEra = sortedByScore[0];
    if (topEra) {
      eraSlots.set(topEra.eraId, (eraSlots.get(topEra.eraId) || 0) + (chaptersRemaining - distributedCount));
    }
  }

  // ── 3. Build era chapters in chronological order ────────────────────────
  const chapters = [];
  const chronologicalEras = [...eras].sort(
    (a, b) => (a.startDate || '').localeCompare(b.startDate || '')
  );

  for (const era of chronologicalEras) {
    const slots = eraSlots.get(era.eraId) || 0;
    if (slots === 0) continue;

    // Filter high-value interactions that belong to this era
    const eraEvIds = new Set(era.keyEvidenceIds || []);
    const eraInteractions = highValueInteractions.filter(
      h => eraEvIds.has(h.evidenceId) || (h.date >= era.startDate && h.date <= era.endDate)
    );

    // Also collect era-specific features
    const eraRareMoments = rareMemorableMoments.filter(
      r => eraEvIds.has(r.evidenceId) && !usedEvidenceIds.has(r.evidenceId)
    );
    const eraContradictions = contradictions.filter(
      c => (eraEvIds.has(c.sideA?.evidenceId) || eraEvIds.has(c.sideB?.evidenceId))
    );
    const eraTurningPoints = turningPoints.filter(
      tp => eraEvIds.has(tp.evidenceId) && !usedEvidenceIds.has(tp.evidenceId)
    );
    const eraCallbacks = confirmedCallbacks.filter(
      cb => eraEvIds.has(cb.original?.evidenceId) || eraEvIds.has(cb.later?.evidenceId)
    );
    const eraPatterns = recurringPatterns.filter(
      p => (p.supportingEvidenceIds || []).some(id => eraEvIds.has(id))
    );

    const eraChapters = _buildChaptersForEra(
      era,
      slots,
      eraInteractions,
      eraRareMoments,
      eraContradictions,
      eraTurningPoints,
      eraCallbacks,
      eraPatterns,
      usedEvidenceIds
    );

    chapters.push(...eraChapters);
  }

  // ── 4. Cross-era callback chapters ─────────────────────────────────────────
  for (let i = 0; i < crossEraCallbackSlots; i++) {
    const cb = crossEraCallbacks[i];
    if (!cb) break;

    const origEv = highValueInteractions.find(h => h.evidenceId === cb.original?.evidenceId);
    const lateEv = highValueInteractions.find(h => h.evidenceId === cb.later?.evidenceId);
    const cbInteractions = [origEv, lateEv].filter(Boolean);

    const origEra = _findEraForEvidence(eras, cb.original?.evidenceId);
    const laterEra = _findEraForEvidence(eras, cb.later?.evidenceId);

    const scenes = buildScenesFromInteractions(
      cbInteractions,
      'CONFIRMED_CALLBACK',
      `Confirmed callback: "${cb.connection}"`
    );

    chapters.push({
      chapterNumber: 0,
      chapterType: 'cross_era_callback',
      title: `The Long-Range Callback`,
      timeRange: `${origEra?.startDate || '?'} → ${laterEra?.endDate || '?'}`,
      eraIds: [origEra?.eraId, laterEra?.eraId].filter(Boolean),
      eraTitle: `Cross-Era (${origEra?.title || '?'} → ${laterEra?.title || '?'})`,
      centralIdea: `An exchange from early in the archive resurfaced later with full context: ${cb.connection}`,
      narrativeAngle: 'Cross-era callback — establish original moment first, then show the callback months later',
      evidenceIds: [cb.original?.evidenceId, cb.later?.evidenceId].filter(Boolean),
      interactionIds: scenes.map(s => s.interactionId),
      scenes,
      relationshipBetweenScenes: 'CONFIRMED_CALLBACK',
      highValueInteractions: cbInteractions,
      relevantCallbacks: [cb],
      relevantContradictions: [],
      relevantPatterns: [],
      whyThisChapterExists: `Confirmed callback across eras: ${cb.connection}`,
      isCrossEra: true,
      sortDate: cb.later?.date || cb.original?.date || '',
    });

    if (cb.original?.evidenceId) usedEvidenceIds.add(cb.original.evidenceId);
    if (cb.later?.evidenceId) usedEvidenceIds.add(cb.later.evidenceId);
  }

  // ── 5. Notable transition chapter ──────────────────────────────────────────
  if (transitionSlots > 0 && notableTransitions.length > 0) {
    const trans = notableTransitions[0];
    const fromEra = scoredEras.find(e => e.eraId === trans.fromEra);
    const toEra   = scoredEras.find(e => e.eraId === trans.toEra);

    const bridgeEvs = (trans.supportingEvidenceIds || [])
      .map(id => highValueInteractions.find(h => h.evidenceId === id))
      .filter(Boolean);

    const scenes = buildScenesFromInteractions(
      bridgeEvs,
      'CONTRAST',
      `Transition bridge: ${trans.description}`
    );

    chapters.push({
      chapterNumber: 0,
      chapterType: 'era_transition',
      title: trans.gapDays >= 14
        ? `The ~${trans.gapDays}-Day Gap`
        : `The Shift: "${trans.fromTitle}" → "${trans.toTitle}"`,
      timeRange: `${fromEra?.endDate || '?'} → ${toEra?.startDate || '?'}`,
      eraIds: [trans.fromEra, trans.toEra],
      eraTitle: `Transition`,
      centralIdea: trans.description,
      narrativeAngle: 'Era transition — what changed across the silence and how the dynamic reset',
      evidenceIds: trans.supportingEvidenceIds || [],
      interactionIds: scenes.map(s => s.interactionId),
      scenes,
      relationshipBetweenScenes: 'CONTRAST',
      highValueInteractions: bridgeEvs,
      relevantCallbacks: [],
      relevantContradictions: [],
      relevantPatterns: [],
      whyThisChapterExists: `This transition itself is a story: ${trans.description}`,
      sortDate: toEra?.startDate || '',
    });
  }

  // ── 6. Standalone rare moment chapter ──────────────────────────────────────
  if (rareMomentSlots > 0 && standaloneRareMoments.length > 0) {
    const rare = standaloneRareMoments[0];
    const rareEv = highValueInteractions.find(h => h.evidenceId === rare.evidenceId);
    const rareInteractions = rareEv ? [rareEv] : [];
    const scenes = buildScenesFromInteractions(
      rareInteractions,
      'SEPARATE',
      `Rare moment: ${rare.summary}`
    );

    chapters.push({
      chapterNumber: 0,
      chapterType: 'rare_moment',
      title: 'The Moment They Dropped The Bit',
      timeRange: rare.date || 'Archive',
      eraIds: [_findEraForEvidence(eras, rare.evidenceId)?.eraId || 'era_01'],
      eraTitle: _findEraForEvidence(eras, rare.evidenceId)?.title || 'Archive',
      centralIdea: `A rare moment of genuine sincerity in an archive otherwise defined by banter. Type: ${rare.type}`,
      narrativeAngle: 'Contrast — the bit drops, something real happens, then the archive continues',
      evidenceIds: [rare.evidenceId].filter(Boolean),
      interactionIds: scenes.map(s => s.interactionId),
      scenes,
      relationshipBetweenScenes: 'SEPARATE',
      highValueInteractions: rareInteractions,
      relevantCallbacks: [],
      relevantContradictions: [],
      relevantPatterns: [],
      whyThisChapterExists: `Rare moment (importance: ${rare.importance}): "${rare.summary}"`,
      sortDate: rare.date || '',
    });

    usedEvidenceIds.add(rare.evidenceId);
  }

  // ── 7. Current state chapter (always last) ────────────────────────────────
  const latestEra = chronologicalEras[chronologicalEras.length - 1];
  const latestEvs = highValueInteractions
    .filter(h => !usedEvidenceIds.has(h.evidenceId))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 2);

  const unresolvedStr = unresolvedThreads.length > 0
    ? `Unresolved: ${unresolvedThreads.map(t => t.topic || '').join(', ')}`
    : '';

  const currentScenes = buildScenesFromInteractions(
    latestEvs,
    'SEPARATE',
    'Current state interaction'
  );

  chapters.push({
    chapterNumber: 0,
    chapterType: 'current_state',
    title: 'Where The Archive Leaves Us',
    timeRange: latestEra?.endDate || co.dateRange || 'Most Recent',
    eraIds: [latestEra?.eraId || 'era_01'],
    eraTitle: latestEra?.title || 'Current',
    centralIdea: `What the most recent conversations look like. ${unresolvedStr}`,
    narrativeAngle: 'Current state — where things stand, what is unresolved, no forced resolution',
    evidenceIds: latestEvs.map(h => h.evidenceId).filter(Boolean),
    interactionIds: currentScenes.map(s => s.interactionId),
    scenes: currentScenes,
    relationshipBetweenScenes: 'SEPARATE',
    highValueInteractions: latestEvs,
    relevantCallbacks: [],
    relevantContradictions: [],
    relevantPatterns: [],
    whyThisChapterExists: 'Every archive needs a current-state chapter — what is the most recent documented dynamic?',
    sortDate: latestEra?.endDate || '',
  });

  // ── 8. Sort chronologically, renumber 1-10, pad/trim ─────────────────────
  const sorted = chapters
    .sort((a, b) => (a.sortDate || '').localeCompare(b.sortDate || ''))
    .slice(0, TARGET_CHAPTERS);

  // Pad if under 10 (defensive)
  while (sorted.length < TARGET_CHAPTERS) {
    const idx = sorted.length;
    const fallbackEra = chronologicalEras[idx % Math.max(1, chronologicalEras.length)];
    const fallbackEvs = highValueInteractions
      .filter(h => !usedEvidenceIds.has(h.evidenceId))
      .slice(0, 2);
    const fallbackScenes = buildScenesFromInteractions(
      fallbackEvs,
      'SEPARATE',
      'Fallback era interaction'
    );

    sorted.push({
      chapterNumber: 0,
      chapterType: 'era_core',
      title: fallbackEra?.title || `Chapter ${idx + 1}`,
      timeRange: fallbackEra?.startDate || '',
      eraIds: [fallbackEra?.eraId || 'era_01'],
      eraTitle: fallbackEra?.title || 'Archive',
      centralIdea: 'A documented period of the archive',
      narrativeAngle: 'Chronological coverage',
      evidenceIds: fallbackEvs.map(h => h.evidenceId).filter(Boolean),
      interactionIds: fallbackScenes.map(s => s.interactionId),
      scenes: fallbackScenes,
      relationshipBetweenScenes: 'SEPARATE',
      highValueInteractions: fallbackEvs,
      relevantCallbacks: [],
      relevantContradictions: [],
      relevantPatterns: [],
      whyThisChapterExists: 'Chronological archive coverage',
      sortDate: fallbackEra?.startDate || '',
    });
  }

  // Renumber 1..10
  const finalChapters = sorted.map((ch, idx) => ({
    ...ch,
    chapterNumber: idx + 1,
    title: ch.title || `Chapter ${idx + 1}`,
  }));

  // Emit telemetry
  const representedEras = new Set(finalChapters.flatMap(c => c.eraIds || []));
  const telemetry = {
    chaptersPlanned: finalChapters.length,
    totalChapters: finalChapters.length,
    erasRepresented: representedEras.size,
    totalEras: eras.length,
    crossEraChapters: finalChapters.filter(c => c.chapterType === 'cross_era_callback').length,
    callbackDrivenChapters: finalChapters.filter(c => (c.relevantCallbacks || []).length > 0 || c.chapterType === 'cross_era_callback').length,
    transitionChapters: finalChapters.filter(c => c.chapterType === 'era_transition').length,
    turningPointChapters: finalChapters.filter(c => c.chapterType === 'turning_point').length,
    rareMomentChapters: finalChapters.filter(c => c.chapterType === 'rare_moment').length,
    coveredEvidenceCount: finalChapters.reduce((acc, c) => acc + (c.evidenceIds || []).length, 0),
    totalScenes: finalChapters.reduce((acc, c) => acc + (c.scenes || []).length, 0),
  };

  return { chapters: finalChapters, telemetry };
}

// ── Helper: Build chapters for one era with explicit scenes ──────────────────

function _buildChaptersForEra(
  era,
  slots,
  interactions,
  rareMoments,
  contradictions,
  turningPoints,
  callbacks,
  patterns,
  usedEvidenceIds
) {
  const lenses = _assignEraLenses(
    slots,
    interactions,
    rareMoments,
    contradictions,
    turningPoints,
    callbacks,
    patterns
  );

  return lenses.map(lens => {
    const lensEvIds = lens.evidenceIds || [];
    lensEvIds.forEach(id => usedEvidenceIds.add(id));

    const lensInteractions = lens.interactions || [];
    const scenes = buildScenesFromInteractions(
      lensInteractions,
      lens.relationshipBetweenScenes || 'SEPARATE',
      lens.reason
    );

    const timeRange = lensInteractions.length > 0
      ? `${lensInteractions[0]?.date || era.startDate} → ${lensInteractions[lensInteractions.length - 1]?.date || era.endDate}`
      : `${era.startDate} → ${era.endDate}`;

    return {
      chapterNumber: 0,  // renumbered later
      chapterType: lens.type,
      title: lens.title || era.title,
      timeRange,
      eraIds: [era.eraId],
      eraTitle: era.title,
      centralIdea: lens.centralIdea,
      narrativeAngle: lens.narrativeAngle,
      evidenceIds: lensEvIds,
      interactionIds: scenes.map(s => s.interactionId),
      scenes,
      relationshipBetweenScenes: lens.relationshipBetweenScenes || 'SEPARATE',
      highValueInteractions: lensInteractions,
      relevantCallbacks: lens.callbacks || [],
      relevantContradictions: lens.contradictions || [],
      relevantPatterns: lens.patterns || [],
      whyThisChapterExists: lens.reason,
      sortDate: lensInteractions[0]?.date || era.startDate || '',
    };
  });
}

/**
 * Assigns narrative lenses to chapter slots for one era.
 * Enforces discrete scene assignments.
 */
function _assignEraLenses(
  slots,
  interactions,
  rareMoments,
  contradictions,
  turningPoints,
  callbacks,
  patterns
) {
  const lenses = [];

  // Lens 1 (always): core era narrative
  lenses.push({
    type: 'era_core',
    title: null,  // will use era title
    centralIdea: `The defining characteristic of this period: ${interactions[0]?.context || 'the documented interaction dynamic'}.`,
    narrativeAngle: 'Core era narrative — the dominant behavior and interaction style of this period',
    evidenceIds: interactions.slice(0, 2).map(h => h.evidenceId),
    interactions: interactions.slice(0, 2),
    relationshipBetweenScenes: 'SEPARATE',
    callbacks: callbacks.slice(0, 1),
    contradictions: [],
    patterns: patterns.slice(0, 1),
    reason: `Core narrative of era: ${interactions.map(h => h.context).slice(0, 2).join('; ')}`,
  });

  if (slots < 2) return lenses;

  // Lens 2: Distinct content type
  if (rareMoments.length > 0) {
    const rare = rareMoments[0];
    lenses.push({
      type: 'rare_moment',
      title: 'The Moment The Dynamic Shifted',
      centralIdea: `Within this period, something unusual happened: "${rare.summary}"`,
      narrativeAngle: 'Contrast — the rare sincere or dramatic moment within an otherwise consistent era',
      evidenceIds: [rare.evidenceId],
      interactions: interactions.filter(h => h.evidenceId === rare.evidenceId).slice(0, 1),
      relationshipBetweenScenes: 'SEPARATE',
      callbacks: [],
      contradictions: [],
      patterns: [],
      reason: `Rare moment in this era (importance: ${rare.importance}): ${rare.summary}`,
    });
  } else if (contradictions.length > 0) {
    const c = contradictions[0];
    lenses.push({
      type: 'contradiction',
      title: 'What Was Said vs What Happened',
      centralIdea: `A documented contradiction within this period: "${c.claim}" vs "${c.laterBehavior}"`,
      narrativeAngle: 'Contradiction — claim vs observable behavior, presented without judgment',
      evidenceIds: [c.sideA?.evidenceId, c.sideB?.evidenceId].filter(Boolean),
      interactions: interactions.filter(h => h.evidenceId === c.sideA?.evidenceId || h.evidenceId === c.sideB?.evidenceId),
      relationshipBetweenScenes: 'CONTRAST',
      callbacks: [],
      contradictions: [c],
      patterns: [],
      reason: `Contradiction within this era: ${c.description}`,
    });
  } else if (turningPoints.length > 0) {
    const tp = turningPoints[0];
    lenses.push({
      type: 'turning_point',
      title: tp.title || 'The Shift',
      centralIdea: `A turning point occurred: "${tp.description}" — Before: ${tp.before} / After: ${tp.after}`,
      narrativeAngle: 'Turning point — what changed and how it changed the subsequent dynamic',
      evidenceIds: [tp.evidenceId].filter(Boolean),
      interactions: interactions.filter(h => h.evidenceId === tp.evidenceId).slice(0, 1),
      relationshipBetweenScenes: 'SEPARATE',
      callbacks: [],
      contradictions: [],
      patterns: [],
      reason: `Turning point: ${tp.title}`,
    });
  } else {
    const next = interactions.slice(2, 4);
    lenses.push({
      type: 'era_core',
      title: null,
      centralIdea: `A different facet of this period: ${next[0]?.context || 'continued dynamic'}.`,
      narrativeAngle: 'Secondary era narrative — a different angle on the same period',
      evidenceIds: next.map(h => h.evidenceId),
      interactions: next,
      relationshipBetweenScenes: 'SEPARATE',
      callbacks: [],
      contradictions: [],
      patterns: patterns.slice(1, 2),
      reason: 'Additional coverage of high-value era interactions',
    });
  }

  if (slots < 3) return lenses;

  // Lens 3: Pattern or recurring topic
  if (patterns.length > 0) {
    const pat = patterns[0];
    const patEvs = (pat.supportingEvidenceIds || [])
      .map(id => interactions.find(h => h.evidenceId === id))
      .filter(Boolean)
      .slice(0, 2);
    lenses.push({
      type: 'recurring_pattern',
      title: `The Pattern: "${pat.pattern?.slice(0, 50) || 'Recurring Behavior'}"`,
      centralIdea: `A recurring pattern identified within this period: "${pat.pattern}"`,
      narrativeAngle: 'Pattern — document first instance, then show recurrence, then name it',
      evidenceIds: (pat.supportingEvidenceIds || []).slice(0, 3),
      interactions: patEvs,
      relationshipBetweenScenes: 'CONTRAST',
      callbacks: [],
      contradictions: [],
      patterns: [pat],
      reason: `Recurring pattern (occurrences: ${pat.occurrences || 2}): ${pat.pattern}`,
    });
  } else {
    const remaining = interactions.slice(4, 6);
    lenses.push({
      type: 'era_core',
      title: null,
      centralIdea: `Further coverage of this era's dynamic.`,
      narrativeAngle: 'Tertiary era narrative — final angle on this period',
      evidenceIds: remaining.map(h => h.evidenceId),
      interactions: remaining,
      relationshipBetweenScenes: 'SEPARATE',
      callbacks: [],
      contradictions: [],
      patterns: [],
      reason: 'Coverage of remaining era material',
    });
  }

  return lenses.slice(0, slots);
}

/**
 * Formats chapter context with explicit SCENE blocks and hard boundary rules.
 */
export function buildChapterSpecificPromptContext(plannedChapter, conversationOverview = {}) {
  const {
    chapterNumber,
    title,
    timeRange,
    eraTitle,
    centralIdea,
    chapterType,
    scenes = [],
    highValueInteractions = [],
    relationshipBetweenScenes = 'SEPARATE',
    relevantCallbacks = [],
    relevantContradictions = [],
    relevantPatterns = [],
  } = plannedChapter;

  const participants = (conversationOverview.participants || []).join(' and ');
  const activeScenes = scenes.length > 0 ? scenes : buildScenesFromInteractions(highValueInteractions, relationshipBetweenScenes);

  const scenesStr = activeScenes.map((sc, i) => {
    const diag = (sc.dialogue || []).map(d => `    ${d}`).join('\n');
    return `============================================================
[SCENE ${i + 1} // Interaction ID: ${sc.interactionId} // Date: ${sc.date || sc.timestamp || 'Archive'}]
${i > 0 ? `RELATIONSHIP TO PREVIOUS SCENE: ${sc.relationshipToPreviousScene}\n` : ''}Context: ${sc.context}
Tone: ${sc.tone}
Actual Dialogue:
${diag}`;
  }).join('\n\n');

  const callbacksStr = relevantCallbacks.length > 0
    ? relevantCallbacks.map(cb => {
        const origDiag = (cb.original?.dialogue || []).map(d => `      ${d}`).join('\n');
        const lateDiag = (cb.later?.dialogue  || []).map(d => `      ${d}`).join('\n');
        return `  [Confirmed Callback]\n  Connection: ${cb.connection}\n  Original (${cb.original?.evidenceId} — ${cb.original?.date}):\n${origDiag}\n  Later Echo (${cb.later?.evidenceId} — ${cb.later?.date}):\n${lateDiag}`;
      }).join('\n\n')
    : '';

  const contradictionsStr = relevantContradictions.length > 0
    ? relevantContradictions.map(c => {
        const diagA = (c.sideA?.dialogue || []).map(d => `      ${d}`).join('\n');
        const diagB = (c.sideB?.dialogue || []).map(d => `      ${d}`).join('\n');
        return `  [Verified Contradiction: ${c.description}]\n  Side A:\n${diagA}\n  Side B:\n${diagB}`;
      }).join('\n\n')
    : '';

  const patternsStr = relevantPatterns.length > 0
    ? relevantPatterns.map(p => `  [Recurring Pattern]: "${p.pattern}" (Occurrences: ${p.occurrences || 2})`).join('\n')
    : '';

  return `CHAPTER ${chapterNumber}: "${title.toUpperCase()}"
Period: ${timeRange}
Era: ${eraTitle}
Participants: ${participants}
Chapter Type: ${chapterType || 'era_core'}
Relationship Between Scenes: ${relationshipBetweenScenes}

Core Narrative Angle: ${centralIdea}

GROUNDED SCENE MATERIAL FOR THIS CHAPTER:
${scenesStr || '(No specific interactions — use the era context and Story Memory)'}

${callbacksStr     ? `VERIFIED CALLBACK DATA:\n${callbacksStr}\n`     : ''}${contradictionsStr ? `VERIFIED CONTRADICTION:\n${contradictionsStr}\n` : ''}${patternsStr      ? `OBSERVED PATTERN:\n${patternsStr}\n`          : ''}
HARD SCENE BOUNDARY & NON-STITCHING RULES FOR THIS CHAPTER:
1. INTERACTION BOUNDARIES ARE STRICT DATA CONSTRAINTS:
   - Each [SCENE] above is a discrete, independent interaction group.
   - NEVER combine or merge separate interaction IDs into a single continuous conversation.
   - If Relationship Between Scenes is "SEPARATE", present Scene 1 completely first (dialogue + reaction + short observation). Then use an explicit transition ("In a separate exchange...", "Separately, later that day...", "Weeks later...") before opening Scene 2.
   - NEVER invent a false conversational bridge (e.g. do NOT say "Rahul then flipped from gifts to Vinicius in the same breath").
2. CALLBACK RULES:
   - If Relationship Between Scenes is "CONFIRMED_CALLBACK", present Scene 1 first. Then show that time passed. Then present Scene 2 and show how Scene 2 explicitly reactivates Scene 1.
3. COMMENTARY RULES:
   - Jump straight into the dialogue/scene first before dropping witty observations.
   - Quote actual dialogue with original Hinglish, slang, and emojis preserved.
   - Target 350-550 words. Punchy, funny, easy-to-read narrative.
   - Do NOT write raw evidence IDs in the narrative text.`;
}

// ── Helper ───────────────────────────────────────────────────────────────────

function _findEraForEvidence(eras, evidenceId) {
  if (!evidenceId) return null;
  return eras.find(e => (e.keyEvidenceIds || []).includes(evidenceId)) || null;
}
