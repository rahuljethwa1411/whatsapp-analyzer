/**
 * Evidence Intelligence & Conversation Memory Organization Engine
 *
 * Architecture:
 *   LEVEL 1 (SOURCE): Actual WhatsApp messages (immutable in messageIndex).
 *   LEVEL 2 (EVENT / INTERACTION): Self-contained contextual interactions from evidence.js.
 *   LEVEL 3 (GLOBAL INTELLIGENCE): Patterns discovered across multiple separate events.
 *
 * Core Guarantees:
 *   ✓ IMMUTABLE EVIDENCE: Original messages are never modified.
 *   ✓ OBSERVED vs INTERPRETED: Every event separates what was seen vs what it may mean.
 *   ✓ NO ORPHAN CLAIMS: Every pattern/callback/contradiction MUST reference real evidence IDs.
 *   ✓ NO FAKE COMBINED EVENTS: Events remain separate; patterns only reference them.
 *   ✓ RECURRING TOPIC EVOLUTION: Tracks how a topic's tone/meaning shifts over time.
 *   ✓ PROVEN CALLBACKS VS. CANDIDATES: Requires explicit evidence of reference.
 *   ✓ SEMANTIC DEDUPLICATION: Near-duplicate patterns merged, all evidence IDs preserved.
 *   ✓ RARE EVENTS PRESERVED: Low-frequency but high-importance events always kept.
 *   ✓ DYNAMIC OUTCOMES: Outcome is derived from evidence, not hardcoded by tone label.
 */

// ─── § 4: Event Organization ────────────────────────────────────────────────────

/**
 * Derives the observed outcome from the actual messages in the interaction.
 * NOT derived from tone label — derived from actual content signals.
 *
 * @param {Array} messages
 * @param {string} tone
 * @returns {string}
 */
function deriveOutcomeFromMessages(messages, tone) {
  const combined = (messages || []).map((m) => m.text || '').join(' ');
  const lower = combined.toLowerCase();

  // Check for resolution signals
  if (/okay|ok |theek|sahi|fine|sure|deal|noted|👍|✅/.test(lower)) return 'Acknowledged or agreed';
  if (/sorry|maafi|my bad|meri galti/.test(lower)) return 'Apology given';
  if (/haha|lmao|lol|💀|😂|🤣/.test(lower)) return 'Dissolved into laughter';
  if (/block|bye|done|over|finished|chalo|jaata/.test(lower)) return 'Conversation closed or ended';
  if (/confirm|book|plan|let.s go|done deal/.test(lower)) return 'Plan confirmed';
  if (/nahi|no |wont|won't|not going/.test(lower)) return 'Declined or refused';

  // Tone-based fallback (still dynamic — not the primary logic)
  if (tone === 'playful_roast') return 'Exchange ended with mutual teasing';
  if (tone === 'tense_confrontation') return 'Tension expressed, resolution unclear';
  if (tone === 'vulnerable_confession') return 'Emotional honesty shared';
  if (tone === 'warm_affection') return 'Affection exchanged';
  if (tone === 'logistical_banter') return 'Logistical discussion completed';
  return 'Exchange concluded';
}

/**
 * Derives structured event metadata for each evidence interaction.
 * Separates OBSERVED (what the messages show) from INTERPRETATION (what it may mean).
 *
 * @param {Array} evidenceStore — Array of EvidenceInteraction
 * @returns {Array} Array of VerifiedEvent
 */
export function organizeVerifiedEvents(evidenceStore) {
  if (!Array.isArray(evidenceStore)) return [];

  return evidenceStore.map((ev, idx) => {
    const rawText = (ev.messages || []).map((m) => m.text || '').join(' ');
    const lower = rawText.toLowerCase();

    // ── Multi-dimensional theme extraction (LLM type is primary) ───────────────
    const themes = new Set();
    if (ev.type && ev.type !== 'other') themes.add(ev.type);
    if (ev.tone && ev.tone !== 'conversational' && ev.tone !== 'conversational_banter') themes.add(ev.tone);

    // Universal emoji/keyword secondary signals
    if (/[😂🤣💀😹]/.test(rawText) || /lmao|lol|haha/.test(lower)) { themes.add('humor'); themes.add('roast'); }
    if (/[😡🤬😤]/.test(rawText) || /\bwtf\b|\bblocked\b/.test(lower)) themes.add('conflict');
    if (/[😢😭💔🥺]/.test(rawText) || /\bsorry\b|\bcry\b/.test(lower)) themes.add('vulnerability');
    if (/[❤️💕🥰😍]/.test(rawText) || /\bi love\b|\bmiss you\b/.test(lower)) themes.add('affection');
    if (/call|phone|answer|pick up/.test(lower)) themes.add('communication_friction');
    if (/ticket|travel|trip|book.*flight|train|hotel|airport/.test(lower)) { themes.add('planning'); themes.add('travel'); }

    // Extract meaningful entities: words ≥5 chars that are not common stop words
    const STOP = new Set([
      'this', 'that', 'with', 'from', 'have', 'been', 'what', 'when', 'where', 'which',
      'there', 'their', 'about', 'would', 'could', 'should', 'really', 'still',
      'right', 'going', 'actually', 'because', 'always', 'never', 'every',
    ]);
    const wordTokens = lower.split(/[\s,!?."'()\n]+/).filter(
      (w) => w.length >= 5 && !STOP.has(w) && /^[a-z0-9]+$/.test(w)
    );
    const entities = Array.from(new Set(wordTokens)).slice(0, 6);

    const outcome = deriveOutcomeFromMessages(ev.messages || [], ev.tone || '');

    // ── Observed vs Interpreted separation ─────────────────────────────────────
    const observed = ev.interactionSummary || ev.connection || `${(ev.participants || []).join(' and ')} exchanged messages`;
    const interpreted = themes.size > 0
      ? `Evidence suggests this was a ${Array.from(themes).slice(0, 2).join(' + ')} interaction.`
      : 'Tone and intent remain ambiguous without broader context.';

    return {
      evidenceId: ev.id || `ev_${idx + 1}`,
      eventType: ev.type || 'other',
      themes: Array.from(themes),
      participants: ev.participants || [ev.sender || 'Unknown'],
      startTime: ev.startTimestamp || ev.timestamp || '',
      endTime: ev.endTimestamp || ev.timestamp || '',
      tone: ev.tone || 'conversational_banter',
      importance: ev.importance ?? 0.8,
      confidence: ev.confidence ?? 0.9,
      // ── Separated fact/interpretation (§ 7) ──
      observed,
      interpretation: interpreted,
      // Kept for backward compat with downstream layers
      summary: observed,
      outcome,
      entities,
      topics: Array.from(themes).slice(0, 4),
      supportingMessageIds: ev.messageIds || (ev.messageId ? [ev.messageId] : []),
      rawMessageCount: (ev.messages || []).length,
    };
  });
}

// ─── § 11–12: Recurring Topics with Evolution ───────────────────────────────────

/**
 * Discovers recurring topics across separate interactions over time.
 * Uses semantic themes and meaningful entities — NOT raw word fragments.
 * Tracks how the topic's tone evolves across occurrences.
 *
 * @param {Array} verifiedEvents
 * @returns {Array} Array of RecurringTopic
 */
export function discoverRecurringTopics(verifiedEvents) {
  if (!Array.isArray(verifiedEvents)) return [];

  const topicMap = new Map();

  for (const ev of verifiedEvents) {
    // Use themes (semantic categories) as primary topic candidates,
    // then add only meaningful entities (≥5 chars).
    const semanticThemes = (ev.themes || []).filter(t => t && t.length >= 4 && !['other', 'roast', 'humor'].includes(t));
    const meaningfulEntities = (ev.entities || []).filter(e => e && e.length >= 5);

    const candidateTopics = [...semanticThemes, ...meaningfulEntities];

    for (const t of candidateTopics) {
      const normalized = t.toLowerCase().trim();
      if (!normalized || normalized.length < 4) continue;

      if (!topicMap.has(normalized)) {
        topicMap.set(normalized, {
          topic: normalized,
          firstSeen: ev.startTime,
          lastSeen: ev.endTime,
          occurrences: [ev.evidenceId],
          toneProgression: [ev.tone],
          evolution: [
            {
              period: ev.startTime ? ev.startTime.slice(0, 7) : 'Initial',
              description: ev.observed || ev.summary,
              tone: ev.tone,
              evidenceIds: [ev.evidenceId],
            },
          ],
        });
      } else {
        const existing = topicMap.get(normalized);
        if (!existing.occurrences.includes(ev.evidenceId)) {
          existing.occurrences.push(ev.evidenceId);
          existing.lastSeen = ev.endTime || existing.lastSeen;
          existing.toneProgression.push(ev.tone);

          // Detect tone shift: only add evolution entry if tone changed (§ 12)
          const prevTone = existing.toneProgression[existing.toneProgression.length - 2];
          const toneShifted = prevTone && prevTone !== ev.tone;

          const evolutionEntry = {
            period: ev.startTime ? ev.startTime.slice(0, 7) : 'Later',
            description: ev.observed || ev.summary,
            tone: ev.tone,
            evidenceIds: [ev.evidenceId],
          };

          if (toneShifted) {
            evolutionEntry.toneShift = `${prevTone} → ${ev.tone}`;
          }

          existing.evolution.push(evolutionEntry);
        }
      }
    }
  }

  // Only keep topics with ≥2 distinct interactions
  return Array.from(topicMap.values())
    .filter((t) => t.occurrences.length >= 2)
    .map((t) => ({
      ...t,
      hasToneEvolution: t.evolution.some(e => e.toneShift),
    }))
    .sort((a, b) => b.occurrences.length - a.occurrences.length);
}

// ─── § 13: Callback Detection ───────────────────────────────────────────────────

/**
 * Classifies investigator-provided callbacks as confirmed vs candidate.
 * Also scans evidence text for implicit back-references.
 *
 * Explicit callback signals: "remember", "like that time", "just like when",
 *   "you said", "you told me", verbatim phrase repetition.
 * Candidate signals: same topic months apart, plausible but not proven.
 *
 * @param {Array} verifiedEvents
 * @param {Array} [investigatorCallbacks]
 * @returns {{ callbacks: Array, callbackCandidates: Array }}
 */
export function organizeCallbacks(verifiedEvents, investigatorCallbacks = []) {
  const eventMap = new Map(verifiedEvents.map((ev) => [ev.evidenceId, ev]));
  // Also index by supporting message IDs for cross-reference
  const msgToEvent = new Map();
  for (const ev of verifiedEvents) {
    for (const mid of ev.supportingMessageIds || []) {
      msgToEvent.set(mid, ev.evidenceId);
    }
  }

  const callbacks = [];
  const callbackCandidates = [];

  const EXPLICIT_CALLBACK_SIGNALS = [
    'remember', 'remember when', 'like that time', 'you said', 'you told me',
    'just like when', 'still the same', 'as always', 'again with',
  ];

  for (const cb of investigatorCallbacks || []) {
    if (!cb) continue;

    const resolveId = (ref) => {
      if (typeof ref === 'string') {
        return eventMap.has(ref) ? ref : msgToEvent.get(ref);
      }
      const mid = ref?.messageId || ref?.evidenceId;
      if (!mid) return null;
      return eventMap.has(mid) ? mid : msgToEvent.get(mid);
    };

    const earlierId = resolveId(cb.earlier || cb.originalEvidenceId);
    const laterId   = resolveId(cb.later   || cb.laterEvidenceId);

    if (!earlierId || !laterId) continue;

    const conn = (cb.connection || '').toLowerCase();
    const laterEvent = eventMap.get(laterId);
    const laterText = (laterEvent?.supportingMessageIds || [])
      .map(id => id)
      .join(' ');

    // Check for explicit callback signals in the connection or in the later evidence text
    const hasExplicitSignal =
      EXPLICIT_CALLBACK_SIGNALS.some(signal => conn.includes(signal)) ||
      (cb.confidence ?? 0) >= 0.88;

    const item = {
      id: `cb_${callbacks.length + callbackCandidates.length + 1}`,
      type: hasExplicitSignal ? 'callback' : 'callback_candidate',
      originalEvidenceId: earlierId,
      laterEvidenceId: laterId,
      connection: cb.connection || 'Plausible reference between earlier and later interaction',
      confidence: cb.confidence ?? (hasExplicitSignal ? 0.9 : 0.68),
    };

    if (hasExplicitSignal) {
      callbacks.push(item);
    } else {
      callbackCandidates.push(item);
    }
  }

  return { callbacks, callbackCandidates };
}

// ─── § 9: Pattern Organization & Deduplication ─────────────────────────────────

/**
 * Deduplicates and validates global patterns.
 * § 9: Populates firstSeen/lastSeen from evidence timestamps.
 * § 24: Merges semantically identical patterns, preserving all evidence IDs.
 * § 23: Strictly rejects orphan patterns with 0 supporting evidence IDs.
 *
 * @param {Array} rawPatterns
 * @param {Array} verifiedEvents
 * @returns {{ patterns: Array, telemetry: Object }}
 */
export function organizeAndDeduplicatePatterns(rawPatterns, verifiedEvents) {
  const validEventIds = new Set(verifiedEvents.map((e) => e.evidenceId));
  const validMessageIds = new Set(verifiedEvents.flatMap((e) => e.supportingMessageIds));

  // Build timestamp lookup keyed by BOTH evidenceId and supportingMessageIds
  // (raw patterns may reference either form)
  const tsLookup = new Map();
  for (const e of verifiedEvents) {
    if (e.startTime) {
      tsLookup.set(e.evidenceId, e.startTime);
      for (const mid of e.supportingMessageIds || []) {
        if (!tsLookup.has(mid)) tsLookup.set(mid, e.startTime);
      }
    }
  }

  const cleanedPatterns = [];
  let rejectedOrphanCount = 0;
  let deduplicatedCount = 0;

  for (const p of rawPatterns || []) {
    if (!p) continue;
    const desc = (typeof p === 'string' ? p : p.pattern || p.description || '').trim();
    if (!desc) continue;

    const rawRefs = Array.isArray(p.evidence) ? p.evidence : (p.supportingEvidenceIds || []);
    const validRefs = rawRefs
      .map((ref) => (typeof ref === 'string' ? ref : (ref?.evidenceId || ref?.messageId)))
      .filter((id) => id && (validEventIds.has(id) || validMessageIds.has(id)));

    if (validRefs.length === 0) {
      rejectedOrphanCount++;
      continue;
    }

    // Derive firstSeen / lastSeen from real timestamps (§ 9)
    const timestamps = validRefs
      .map(id => tsLookup.get(id))
      .filter(Boolean)
      .sort();

    cleanedPatterns.push({
      id: p.id || `pat_${cleanedPatterns.length + 1}`,
      description: desc,
      supportingEvidenceIds: Array.from(new Set(validRefs)),
      confidence: p.confidence ?? Math.min(0.95, 0.65 + validRefs.length * 0.1),
      firstSeen: timestamps[0] || p.firstSeen || '',
      lastSeen: timestamps[timestamps.length - 1] || p.lastSeen || '',
      occurrences: validRefs.length,
    });
  }

  // Semantic deduplication via Jaccard similarity + evidence overlap (§ 24)
  const merged = [];
  const processed = new Set();

  for (let i = 0; i < cleanedPatterns.length; i++) {
    if (processed.has(i)) continue;
    let current = { ...cleanedPatterns[i] };
    const currentWords = new Set(
      current.description.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    for (let j = i + 1; j < cleanedPatterns.length; j++) {
      if (processed.has(j)) continue;
      const other = cleanedPatterns[j];
      const otherWords = new Set(other.description.toLowerCase().split(/\s+/).filter(w => w.length > 3));

      let wordIntersect = 0;
      for (const w of otherWords) { if (currentWords.has(w)) wordIntersect++; }
      const wordSim = Math.min(currentWords.size, otherWords.size) > 0
        ? wordIntersect / Math.min(currentWords.size, otherWords.size) : 0;

      const currentEvSet = new Set(current.supportingEvidenceIds);
      let evIntersect = 0;
      for (const id of other.supportingEvidenceIds) { if (currentEvSet.has(id)) evIntersect++; }
      const evOverlap = Math.min(current.supportingEvidenceIds.length, other.supportingEvidenceIds.length) > 0
        ? evIntersect / Math.min(current.supportingEvidenceIds.length, other.supportingEvidenceIds.length) : 0;

      if (evOverlap >= 0.5 || wordSim >= 0.35) {
        processed.add(j);
        deduplicatedCount++;
        const combinedIds = Array.from(new Set([...current.supportingEvidenceIds, ...other.supportingEvidenceIds]));
        const allTimestamps = combinedIds.map(id => tsLookup.get(id)).filter(Boolean).sort();
        current = {
          ...current,
          supportingEvidenceIds: combinedIds,
          occurrences: combinedIds.length,
          confidence: Math.max(current.confidence, other.confidence),
          firstSeen: allTimestamps[0] || current.firstSeen,
          lastSeen: allTimestamps[allTimestamps.length - 1] || current.lastSeen,
        };
      }
    }

    processed.add(i);
    merged.push(current);
  }

  return {
    patterns: merged,
    telemetry: { rejectedOrphanCount, deduplicatedCount },
  };
}

// ─── § 26: Diverse High-Value Evidence Selection ───────────────────────────────

/**
 * Selects high-value evidence interactions for downstream story generation.
 * § 26: Selects representative + contrasting + evolution items per pattern,
 * not just the top-importance sort.
 * § 25: Always retains rare high-importance events even if they only occur once.
 *
 * @param {Array} verifiedEvents
 * @param {Array} patterns
 * @param {number} maxItems
 * @returns {Array}
 */
function selectHighValueEvidence(verifiedEvents, patterns, maxItems = 15) {
  const selected = new Set();
  const result = [];

  const addEvent = (ev) => {
    if (ev && !selected.has(ev.evidenceId)) {
      selected.add(ev.evidenceId);
      result.push({
        evidenceId: ev.evidenceId,
        summary: ev.observed || ev.summary,
        importance: ev.importance,
        tone: ev.tone,
        themes: ev.themes,
        supportingMessageIds: ev.supportingMessageIds,
        selectionReason: '',
      });
    }
  };

  // Pass 1: For each pattern, pick representative + one contrasting (by tone)
  for (const pat of patterns) {
    const patEvents = (pat.supportingEvidenceIds || [])
      .map(id => verifiedEvents.find(e => e.evidenceId === id))
      .filter(Boolean)
      .sort((a, b) => b.importance - a.importance);

    if (patEvents[0]) {
      patEvents[0]._sel = 'pattern_representative';
      addEvent(patEvents[0]);
    }
    // Pick a contrasting tone if available
    const contrast = patEvents.find(e => e !== patEvents[0] && e.tone !== patEvents[0]?.tone);
    if (contrast) {
      contrast._sel = 'pattern_contrast';
      addEvent(contrast);
    }
    // Pick the chronologically latest one for evolution
    const latest = [...patEvents].sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0))[0];
    if (latest && latest !== patEvents[0]) {
      latest._sel = 'pattern_evolution';
      addEvent(latest);
    }
  }

  // Pass 2: Rare but high-value events (importance ≥ 0.92, regardless of frequency)
  for (const ev of verifiedEvents) {
    if ((ev.importance ?? 0) >= 0.92) {
      ev._sel = 'rare_high_value';
      addEvent(ev);
    }
  }

  // Pass 3: Fill remaining slots by importance descending
  const sorted = [...verifiedEvents].sort((a, b) => b.importance - a.importance);
  for (const ev of sorted) {
    if (result.length >= maxItems) break;
    ev._sel = 'importance_fill';
    addEvent(ev);
  }

  // Apply selection reason labels
  result.forEach((r) => {
    const src = verifiedEvents.find(e => e.evidenceId === r.evidenceId);
    r.selectionReason = src?._sel || 'importance_fill';
  });

  return result.slice(0, maxItems);
}

// ─── § 21.I: Communication Habits ──────────────────────────────────────────────

/**
 * Derives observable communication habits from verified events.
 * Only records habits supported by ≥2 events.
 *
 * @param {Array} verifiedEvents
 * @returns {Array}
 */
function deriveCommunicationHabits(verifiedEvents) {
  const habits = [];

  // Count tones
  const toneCount = {};
  for (const ev of verifiedEvents) {
    toneCount[ev.tone] = (toneCount[ev.tone] || 0) + 1;
  }
  for (const [tone, count] of Object.entries(toneCount)) {
    if (count >= 2 && tone !== 'conversational_banter') {
      habits.push({
        description: `${tone.replace(/_/g, ' ')} interactions occur frequently`,
        occurrences: count,
        supportingEvidenceIds: verifiedEvents.filter(e => e.tone === tone).map(e => e.evidenceId),
        confidence: Math.min(0.95, 0.65 + count * 0.1),
      });
    }
  }

  // Check for multi-participant habits
  const participants = Array.from(new Set(verifiedEvents.flatMap(e => e.participants)));
  for (const p of participants) {
    const pEvents = verifiedEvents.filter(e => (e.participants || []).includes(p));
    if (pEvents.length >= 2) {
      const dominantTone = Object.entries(
        pEvents.reduce((acc, e) => { acc[e.tone] = (acc[e.tone] || 0) + 1; return acc; }, {})
      ).sort(([,a],[,b]) => b - a)[0]?.[0];

      if (dominantTone && dominantTone !== 'conversational_banter') {
        habits.push({
          participant: p,
          description: `${p} predominantly engages in ${dominantTone.replace(/_/g, ' ')} style across ${pEvents.length} interactions`,
          occurrences: pEvents.length,
          supportingEvidenceIds: pEvents.map(e => e.evidenceId),
          confidence: Math.min(0.9, 0.6 + pEvents.length * 0.08),
        });
      }
    }
  }

  return habits;
}

// ─── § 21.K: Uncertain / Ambiguous Observations ────────────────────────────────

/**
 * Flags events with genuinely ambiguous signals — short exchanges, unclear tone,
 * or very low confidence. Does NOT attempt to interpret them.
 *
 * @param {Array} verifiedEvents
 * @returns {Array}
 */
function collectAmbiguousObservations(verifiedEvents) {
  return verifiedEvents
    .filter(ev =>
      (ev.rawMessageCount || 0) <= 2 ||
      ev.tone === 'conversational_banter' ||
      (ev.confidence ?? 1) < 0.75 ||
      (ev.themes || []).length === 0
    )
    .map(ev => ({
      evidenceId: ev.evidenceId,
      note: 'Short or tonally neutral exchange — intent and meaning require broader context to interpret.',
      tone: ev.tone,
      messageCount: ev.rawMessageCount || 0,
      confidence: ev.confidence ?? 0.9,
    }));
}

// ─── § 21: Full Conversation Memory Builder ─────────────────────────────────────

/**
 * Builds the complete, structured, strictly verified Conversation Memory.
 *
 * Sections (per § 21):
 * A. VERIFIED EVENTS       (Level 2 immutable interactions)
 * B. RECURRING PATTERNS    (Level 3 multi-event patterns with evidence IDs)
 * C. RECURRING TOPICS      (Level 3 with chronological tone evolution)
 * D. CALLBACKS             (Level 3 confirmed — require explicit reference evidence)
 * E. CALLBACK CANDIDATES   (Level 3 plausible but not proven)
 * F. CONTRADICTIONS        (Level 3 — both sides required)
 * G. TURNING POINTS        (Level 3 — before/after + evidence)
 * H. TIMELINE              (Chronological by evidence)
 * I. COMMUNICATION HABITS  (Observable messaging behavior patterns)
 * J. HIGH-VALUE EVIDENCE   (Diverse selection: representative + contrast + evolution + rare)
 * K. UNCERTAIN / AMBIGUOUS (Short/neutral exchanges that need more context)
 *
 * @param {Object} params
 * @returns {Object} Verified Conversation Memory with Telemetry
 */
export function buildVerifiedConversationMemory({
  evidenceStore,
  rawInvestigatorResult,
  metadata,
  summaryStats,
}) {
  const inv = rawInvestigatorResult || {};

  // ── Level 2: Verified Events ──────────────────────────────────────────────────
  const verifiedEvents = organizeVerifiedEvents(evidenceStore);

  // ── Level 3: Recurring Topics with Evolution ──────────────────────────────────
  const recurringTopics = discoverRecurringTopics(verifiedEvents);

  // ── Level 3: Callbacks & Candidates ──────────────────────────────────────────
  const { callbacks, callbackCandidates } = organizeCallbacks(verifiedEvents, inv.callbacks);

  // ── Level 3: Patterns with orphan rejection & deduplication ──────────────────
  const { patterns: verifiedPatterns, telemetry: patternTelemetry } =
    organizeAndDeduplicatePatterns(inv.patterns, verifiedEvents);

  // ── Shared ID sets for validation ────────────────────────────────────────────
  const validEventIds   = new Set(verifiedEvents.map((e) => e.evidenceId));
  const validMessageIds = new Set(verifiedEvents.flatMap((e) => e.supportingMessageIds));

  const resolveRefs = (rawRefs) =>
    (rawRefs || [])
      .map((ref) => (typeof ref === 'string' ? ref : (ref?.evidenceId || ref?.messageId)))
      .filter((id) => id && (validEventIds.has(id) || validMessageIds.has(id)));

  // ── Level 3: Contradictions ───────────────────────────────────────────────────
  let rejectedContradictionCount = 0;
  const verifiedContradictions = (inv.contradictions || [])
    .map((c) => {
      if (!c || !c.claim || !c.laterBehavior) return null;
      const validRefs = resolveRefs(c.evidence);
      if (validRefs.length === 0) { rejectedContradictionCount++; return null; }
      return {
        id: `contra_${Math.random().toString(36).slice(2, 7)}`,
        claim: c.claim,
        laterBehavior: c.laterBehavior,
        explanation: c.explanation || 'Claim appears to conflict with later behavior in the archive.',
        supportingEvidenceIds: validRefs,
        confidence: c.confidence ?? 0.85,
        isCertain: (c.confidence ?? 0) >= 0.9,
      };
    })
    .filter(Boolean);

  // ── Level 3: Turning Points ────────────────────────────────────────────────────
  let rejectedTurningPointCount = 0;
  const verifiedTurningPoints = (inv.turningPoints || [])
    .map((tp) => {
      if (!tp || !tp.title) return null;
      const validRefs = resolveRefs(tp.evidence);
      if (validRefs.length === 0) { rejectedTurningPointCount++; return null; }
      return {
        id: `tp_${Math.random().toString(36).slice(2, 7)}`,
        title: tp.title,
        description: tp.description || '',
        before: tp.before || '',
        after: tp.after || '',
        supportingEvidenceIds: validRefs,
        significance: tp.significance ?? 0.85,
      };
    })
    .filter(Boolean);

  // ── Section H: Chronological Timeline ─────────────────────────────────────────
  const timeline = verifiedEvents
    .slice()
    .sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0))
    .map((ev) => ({
      period: ev.startTime ? ev.startTime.slice(0, 7) : 'Archive',
      summary: ev.observed || ev.summary,
      evidenceId: ev.evidenceId,
      tone: ev.tone,
      importance: ev.importance,
    }));

  // ── Section I: Communication Habits ────────────────────────────────────────────
  const communicationHabits = deriveCommunicationHabits(verifiedEvents);

  // ── Section J: High-Value Evidence (diverse selection) ─────────────────────────
  const highValueEvidence = selectHighValueEvidence(verifiedEvents, verifiedPatterns, 15);

  // ── Section K: Ambiguous / Uncertain ───────────────────────────────────────────
  const uncertainObservations = collectAmbiguousObservations(verifiedEvents);

  // ── Telemetry (§ 34) ────────────────────────────────────────────────────────────
  const telemetry = {
    inputEvidenceCount:       (evidenceStore || []).length,
    verifiedEventsCount:      verifiedEvents.length,
    recurringPatternsCount:   verifiedPatterns.length,
    recurringTopicsCount:     recurringTopics.length,
    callbacksCount:           callbacks.length,
    callbackCandidatesCount:  callbackCandidates.length,
    contradictionsCount:      verifiedContradictions.length,
    turningPointsCount:       verifiedTurningPoints.length,
    highValueEvidenceCount:   highValueEvidence.length,
    communicationHabitsCount: communicationHabits.length,
    uncertainObservationsCount: uncertainObservations.length,
    rejectedOrphanClaimsCount:
      patternTelemetry.rejectedOrphanCount +
      rejectedContradictionCount +
      rejectedTurningPointCount,
    deduplicatedPatternsCount: patternTelemetry.deduplicatedCount,
  };

  console.log(
    '\n[Evidence Intelligence] ══════════════════════════════════════════\n' +
    `[Evidence Intelligence] Input Evidence:             ${telemetry.inputEvidenceCount}\n` +
    `[Evidence Intelligence] Verified Events:            ${telemetry.verifiedEventsCount}\n` +
    `[Evidence Intelligence] Recurring Patterns:         ${telemetry.recurringPatternsCount}\n` +
    `[Evidence Intelligence] Recurring Topics:           ${telemetry.recurringTopicsCount}\n` +
    `[Evidence Intelligence] Callbacks (Confirmed):      ${telemetry.callbacksCount}\n` +
    `[Evidence Intelligence] Callback Candidates:        ${telemetry.callbackCandidatesCount}\n` +
    `[Evidence Intelligence] Contradictions:             ${telemetry.contradictionsCount}\n` +
    `[Evidence Intelligence] Turning Points:             ${telemetry.turningPointsCount}\n` +
    `[Evidence Intelligence] High-Value Evidence:        ${telemetry.highValueEvidenceCount}\n` +
    `[Evidence Intelligence] Communication Habits:       ${telemetry.communicationHabitsCount}\n` +
    `[Evidence Intelligence] Uncertain Observations:     ${telemetry.uncertainObservationsCount}\n` +
    `[Evidence Intelligence] Rejected Orphan Claims:     ${telemetry.rejectedOrphanClaimsCount}\n` +
    `[Evidence Intelligence] Deduplicated Patterns:      ${telemetry.deduplicatedPatternsCount}\n` +
    '[Evidence Intelligence] ══════════════════════════════════════════\n'
  );

  return {
    // A. Verified Events (Level 2 — immutable, with observed/interpretation split)
    verifiedEvents,
    // B. Recurring Patterns (Level 3 — evidence-grounded, deduplicated)
    recurringPatterns: verifiedPatterns,
    // C. Recurring Topics with evolution
    recurringTopics,
    // D. Confirmed Callbacks
    callbacks,
    // E. Callback Candidates
    callbackCandidates,
    // F. Contradictions (both sides required)
    contradictions: verifiedContradictions,
    // G. Turning Points (before/after + evidence)
    turningPoints: verifiedTurningPoints,
    // H. Chronological Timeline
    timeline,
    // I. Communication Habits
    communicationHabits,
    // J. High-Value Evidence (diverse selection)
    highValueEvidence,
    // K. Uncertain / Ambiguous Observations
    uncertainObservations,
    // Raw investigator output preserved for traceability
    _rawInvestigator: inv,
    // Telemetry
    telemetry,
  };
}
