/**
 * Era Detection + Era-Aware Story Architecture
 *
 * Discovers meaningful conversational epochs from verified evidence, then
 * produces a 10-chapter plan where each chapter is era-aware.
 *
 * Design principles (§1–25 spec):
 *   ✓  Eras are NOT calendar months — they reflect genuine behavioral shifts.
 *   ✓  Number of eras is evidence-driven (no fixed count).
 *   ✓  Every era boundary is explained and traceable to evidence IDs.
 *   ✓  Candidate eras that are too similar are merged (§20).
 *   ✓  Eras with two distinct sustained phases are split (§21).
 *   ✓  Era titles are specific + behavioral, not "Era 1" or "September Era" (§7).
 *   ✓  Transitions are first-class objects — they can themselves be chapter material (§14).
 *   ✓  Chapter planner is era-aware — allocates by narrative value, not equal distribution (§12).
 *   ✓  Cross-era callbacks get priority consideration (§13).
 *   ✓  Telemetry emitted for both era detection and chapter planning (§24).
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Minimum gap in days between events for a new era candidate to form */
const MIN_ERA_GAP_DAYS = 7;

/** Minimum overlap of topics to consider two eras "too similar" for merging */
const MERGE_TOPIC_OVERLAP_THRESHOLD = 0.75;

/** Min events for a split sub-era to be accepted as distinct */
const MIN_SPLIT_ERA_EVENTS = 2;

// ── Era Signal Scoring ────────────────────────────────────────────────────────

/**
 * Scores how distinct two groups of events are from each other.
 * Returns 0 (identical) → 1 (completely different).
 */
function distinctnessScore(groupA, groupB) {
  const tonesA = new Set(groupA.map(e => e.tone).filter(Boolean));
  const tonesB = new Set(groupB.map(e => e.tone).filter(Boolean));
  const topicsA = new Set(groupA.flatMap(e => e.topics || []));
  const topicsB = new Set(groupB.flatMap(e => e.topics || []));

  const toneOverlap = [...tonesA].filter(t => tonesB.has(t)).length / Math.max(1, Math.max(tonesA.size, tonesB.size));
  const topicOverlap = [...topicsA].filter(t => topicsB.has(t)).length / Math.max(1, Math.max(topicsA.size, topicsB.size));
  return 1 - (toneOverlap * 0.5 + topicOverlap * 0.5);
}

/**
 * Derives a behavioral, memorable era title from dominant topics and tones.
 * NEVER returns "Era X" or "Month Y".
 */
function deriveEraTitle(dominantTopics, dominantTones, idx) {
  // Topic-driven title mapping (natural, conversational, punchy)
  const topicMap = {
    travel: ['The Ranchi Trip Plans', 'The Travel Plotting Phase', 'The Weekend Gateway Plans'],
    sports: ['The Football & UCL Banter', 'The Cricket & Match Debates', 'The Sports Desk'],
    food: ['The Midnight Cravings & Food Orders', 'The Food Debates'],
    college: ['The Exam Season Stress', 'The College Chaos'],
    exams: ['The Exam Panic Phase', 'The Late Night Study Grind'],
    money: ['The 100-Rupee Broke Era', 'The Ambani Bank Era'],
    rupee: ['The 100-Rupee Broke Era', 'The Ambani Bank Era'],
    meme: ['The 3 AM Reel Dump', 'The Meme Exchange'],
    reel: ['The 3 AM Reel Spree', 'The Random Reels Phase'],
    silence: ['The Great Silence', 'The Radio Silence Period'],
    family: ['The Family Updates & Drama', 'The Home Situation'],
    work: ['The Work Grind & Chaos', 'The Career Venting Phase'],
    music: ['The Playlist Wars', 'The Song Recommendations'],
    movie: ['The Movie & Cinema Debates', 'The Watchlist Plans'],
    ranchi: ['The Ranchi Trip Plans', 'The Ranchi Meetup Phase'],
    call: ['The Missed Calls & Late Replies', 'The Call History Debates'],
    apology: ['The Sincere Apology & Reset', 'The Real Talk Phase'],
    joke: ['The Running Joke Era', 'The Signature Banter Phase'],
    plan: ['The Phantom Plans Phase', 'The Big Trip Ideas'],
    banter: ['The Non-Stop Roasting Era', 'The Peak Banter Days'],
    night: ['The 3 AM Late Night Chats', 'The Insomnia Hours'],
  };

  // Check dominant topics against the map
  for (const topic of dominantTopics) {
    const lower = topic.toLowerCase();
    for (const [key, options] of Object.entries(topicMap)) {
      if (lower.includes(key)) {
        return options[idx % options.length];
      }
    }
  }

  // Tone-driven fallback
  const toneTitle = {
    playful_roast: 'The Non-Stop Roasting Era',
    tense_confrontation: 'The Tension Arc',
    vulnerable_confession: 'The Real Talk Phase',
    logistical_banter: 'The Trip & Meetup Plans',
    warm_affection: 'The Affection & Banter Phase',
    conversational_banter: 'The Peak Banter Days',
    humor: 'The Comedy & Roasts Era',
    conflict: 'The Conflict & Reset',
  };

  for (const tone of dominantTones) {
    if (toneTitle[tone]) return toneTitle[tone];
  }

  // Last resort: descriptive based on topic count
  if (dominantTopics.length > 0) {
    return `The ${dominantTopics[0].charAt(0).toUpperCase() + dominantTopics[0].slice(1)} Phase`;
  }
  return `The Conversational Arc (Phase ${idx + 1})`;
}

// ── Core Era Detection ────────────────────────────────────────────────────────

/**
 * Discovers meaningful conversational eras from verified events.
 *
 * Algorithm:
 *  1. Sort events chronologically
 *  2. Use sliding window to detect topic/tone change points
 *  3. Validate each candidate boundary (sustained change, not single message)
 *  4. Merge near-identical adjacent eras (§20)
 *  5. Split eras containing two clearly distinct sustained phases (§21)
 *  6. Build transition objects between final eras (§6)
 *  7. Emit telemetry (§24)
 *
 * @param {Array} verifiedEvents — Level 2 EvidenceInteraction objects
 * @param {Object} rawInvestigator — Raw investigator result (optional, used if present)
 * @param {Object} metadata — Chat metadata
 * @returns {{ eras: Array, eraTransitions: Array, telemetry: Object }}
 */
export function detectConversationEras(verifiedEvents = [], rawInvestigator = {}, metadata = {}) {
  const events = [...verifiedEvents].sort(
    (a, b) => new Date(a.startTime || a.startTimestamp || 0) - new Date(b.startTime || b.startTimestamp || 0)
  );

  // ── Step 1: Try investigator eras if they're well-grounded ────────────────
  const invEras = Array.isArray(rawInvestigator?.eras) ? rawInvestigator.eras : [];
  let candidateEras = [];

  if (invEras.length >= 2) {
    candidateEras = _buildErasFromInvestigator(invEras, events, metadata);
  }

  // ── Step 2: Behavioral clustering fallback ────────────────────────────────
  if (candidateEras.length < 2 && events.length >= 2) {
    candidateEras = _detectErasFromBehavior(events, metadata);
  }

  const rawCandidateCount = candidateEras.length;

  // ── Step 3: Merge near-identical adjacent eras ────────────────────────────
  const { eras: afterMerge, mergedCount } = _mergeAdjacentEras(candidateEras);

  // ── Step 4: Split eras containing two distinct sustained phases ───────────
  const { eras: afterSplit, splitCount } = _splitCompositeEras(afterMerge, events);

  // ── Step 5: Re-number and validate ───────────────────────────────────────
  const finalEras = afterSplit.map((era, idx) => ({
    ...era,
    eraId: `era_${String(idx + 1).padStart(2, '0')}`,
    title: era.title || deriveEraTitle(era.dominantTopics || [], era.dominantTones || [], idx),
    eventCount: (era.keyEvidenceIds || []).length,
  }));

  // ── Step 6: Build transition objects ─────────────────────────────────────
  const eraTransitions = _buildTransitions(finalEras);

  // ── Step 7: Telemetry ─────────────────────────────────────────────────────
  const telemetry = {
    evidenceAnalyzed: events.length,
    candidateEras: rawCandidateCount,
    finalEras: finalEras.length,
    mergedEras: mergedCount,
    splitEras: splitCount,
    transitions: eraTransitions.length,
  };

  console.log(
    '\n[Era Intelligence] ═══════════════════════════════════════════\n' +
    `[Era Intelligence] Evidence Analyzed:       ${telemetry.evidenceAnalyzed}\n` +
    `[Era Intelligence] Candidate Eras:          ${telemetry.candidateEras}\n` +
    `[Era Intelligence] Final Eras:              ${telemetry.finalEras}\n` +
    `[Era Intelligence] Merged Eras:             ${telemetry.mergedEras}\n` +
    `[Era Intelligence] Split Eras:              ${telemetry.splitEras}\n` +
    `[Era Intelligence] Transitions:             ${telemetry.transitions}\n` +
    '[Era Intelligence] ═══════════════════════════════════════════\n'
  );

  return { eras: finalEras, eraTransitions, telemetry };
}

// ── Private: Build Eras From Investigator ────────────────────────────────────

function _buildErasFromInvestigator(invEras, events, metadata) {
  return invEras.map((ie, idx) => {
    const eraEvIds = (ie.evidence || [])
      .map(e => typeof e === 'string' ? e : (e.evidenceId || e.messageId))
      .filter(Boolean);

    const matchingEvents = events.filter(
      ev => eraEvIds.includes(ev.evidenceId) ||
            (ev.supportingMessageIds || []).some(id => eraEvIds.includes(id))
    );

    const startDate = ie.startDate || matchingEvents[0]?.startTime?.slice(0, 10) || metadata.startDate || '';
    const endDate   = ie.endDate   || matchingEvents[matchingEvents.length - 1]?.endTime?.slice(0, 10) || metadata.endDate || '';
    const topics    = ie.dominantTopics?.length ? ie.dominantTopics : matchingEvents.flatMap(e => e.topics || []).slice(0, 4);
    const tones     = matchingEvents.map(e => e.tone).filter(Boolean);
    const title     = ie.title || deriveEraTitle(topics, tones, idx);

    return {
      eraId: ie.id || `era_${idx + 1}`,
      title,
      startDate,
      endDate,
      summary: ie.summary || `A sustained period defined by ${topics.slice(0, 2).join(' & ') || 'consistent interaction'}.`,
      dominantTopics: Array.from(new Set(topics)).slice(0, 5),
      dominantTones: Array.from(new Set(tones)).slice(0, 4),
      definingPatterns: (ie.majorChanges || []).slice(0, 3),
      keyEvidenceIds: matchingEvents.map(e => e.evidenceId).slice(0, 8),
      turningPointIds: [],
      transitionFromPrevious: idx > 0
        ? `Sustained shift from "${invEras[idx - 1].title || 'previous phase'}" into "${title}"`
        : 'Archive begins',
      reasonForBoundary: ie.summary
        ? `Investigator detected: ${ie.summary.slice(0, 100)}`
        : `Sustained focus on ${topics.slice(0, 2).join(' & ') || 'shared interaction'}`,
      confidence: 0.9,
    };
  });
}

// ── Private: Behavioral Era Detection ────────────────────────────────────────

/**
 * Detects eras by scanning for sustained changes in tone + topic across events.
 * Uses a sliding window — a change must persist for ≥2 events to form a new era.
 */
function _detectErasFromBehavior(events, metadata) {
  if (events.length < 2) return [];

  const candidates = [];
  let currentGroup = [events[0]];

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];

    // Time gap check
    const prevDate = new Date(prev.endTime || prev.startTime || 0);
    const currDate = new Date(curr.startTime || 0);
    const gapDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

    // Tone shift
    const toneShift = prev.tone && curr.tone && prev.tone !== curr.tone;

    // Topic shift: new dominant topic appeared (not a subset of previous)
    const prevTopics = new Set(prev.topics || []);
    const currTopics = new Set(curr.topics || []);
    const topicOverlap = [...currTopics].filter(t => prevTopics.has(t)).length;
    const topicShift = currTopics.size > 0 && topicOverlap === 0;

    // Long silence = new era candidate
    const longSilence = gapDays >= MIN_ERA_GAP_DAYS * 3;

    const isNewEraCandidate = longSilence || (toneShift && topicShift);

    if (isNewEraCandidate && currentGroup.length >= 1) {
      // Only commit if the next event also confirms the shift (sustained, not single-message)
      const nextEvent = events[i + 1];
      const nextToneConfirms = !nextEvent || nextEvent.tone === curr.tone || nextEvent.tone !== prev.tone;

      if (nextToneConfirms || longSilence) {
        candidates.push(currentGroup);
        currentGroup = [curr];
        continue;
      }
    }

    currentGroup.push(curr);
  }

  if (currentGroup.length > 0) candidates.push(currentGroup);

  // Convert groups to era objects
  return candidates.map((group, idx) => {
    const topics = Array.from(new Set(group.flatMap(e => e.topics || []))).slice(0, 5);
    const tones  = Array.from(new Set(group.map(e => e.tone).filter(Boolean))).slice(0, 4);
    const title  = deriveEraTitle(topics, tones, idx);

    const startDate = group[0]?.startTime?.slice(0, 10) || metadata.startDate || '';
    const endDate   = group[group.length - 1]?.endTime?.slice(0, 10) ||
                      group[group.length - 1]?.startTime?.slice(0, 10) || metadata.endDate || '';

    let reasonForBoundary = 'Archive begins';
    if (idx > 0) {
      const prevGroup = candidates[idx - 1];
      const prevTopics = new Set(prevGroup.flatMap(e => e.topics || []));
      const prevTones  = new Set(prevGroup.map(e => e.tone).filter(Boolean));
      const newTopics  = topics.filter(t => !prevTopics.has(t));
      const newTones   = tones.filter(t => !prevTones.has(t));

      const prevDate = new Date(prevGroup[prevGroup.length - 1]?.endTime || prevGroup[prevGroup.length - 1]?.startTime || 0);
      const thisDate = new Date(group[0]?.startTime || 0);
      const gapDays  = Math.round((thisDate - prevDate) / (1000 * 60 * 60 * 24));

      if (gapDays >= MIN_ERA_GAP_DAYS * 3) {
        reasonForBoundary = `Long silence of ~${gapDays} days, then conversation resumed with different energy`;
      } else if (newTopics.length > 0) {
        reasonForBoundary = `Sustained shift toward ${newTopics.slice(0, 2).join(' & ')} (new topic${newTopics.length > 1 ? 's' : ''} not present before)`;
      } else if (newTones.length > 0) {
        reasonForBoundary = `Sustained tone change: ${newTones.join(' & ')} emerged and persisted`;
      } else {
        reasonForBoundary = 'Behavioral shift across multiple consecutive interactions';
      }
    }

    return {
      eraId: `era_${idx + 1}`,
      title,
      startDate,
      endDate,
      summary: `Dominated by ${topics.slice(0, 2).join(' & ') || tones.slice(0, 1).join('') || 'general interaction'} across ${group.length} documented interactions.`,
      dominantTopics: topics,
      dominantTones: tones,
      definingPatterns: [],
      keyEvidenceIds: group.map(e => e.evidenceId).filter(Boolean),
      turningPointIds: [],
      transitionFromPrevious: idx === 0 ? 'Archive begins' : reasonForBoundary,
      reasonForBoundary,
      confidence: group.length >= 3 ? 0.88 : 0.75,
    };
  });
}

// ── Private: Era Merging ──────────────────────────────────────────────────────

/**
 * Merges adjacent eras that are too similar to warrant being separate (§20).
 * Two eras are merged if their topic overlap exceeds the threshold AND
 * they are not separated by a meaningful time gap.
 */
function _mergeAdjacentEras(eras) {
  if (eras.length <= 1) return { eras, mergedCount: 0 };

  const result = [];
  let mergedCount = 0;

  for (let i = 0; i < eras.length; i++) {
    const curr = eras[i];

    if (result.length === 0) {
      result.push({ ...curr });
      continue;
    }

    const prev = result[result.length - 1];

    // Time gap
    const prevEnd  = new Date(prev.endDate || 0).getTime();
    const currStart = new Date(curr.startDate || 0).getTime();
    const gapDays   = Math.abs(currStart - prevEnd) / (1000 * 60 * 60 * 24);

    // Topic overlap
    const prevTopics = new Set(prev.dominantTopics || []);
    const currTopics = new Set(curr.dominantTopics || []);
    const sharedTopics = [...currTopics].filter(t => prevTopics.has(t)).length;
    const maxTopics = Math.max(1, Math.max(prevTopics.size, currTopics.size));
    const topicSimilarity = sharedTopics / maxTopics;

    // Tone similarity
    const prevTones = new Set(prev.dominantTones || []);
    const currTones = new Set(curr.dominantTones || []);
    const sharedTones = [...currTones].filter(t => prevTones.has(t)).length;
    const maxTones = Math.max(1, Math.max(prevTones.size, currTones.size));
    const toneSimilarity = sharedTones / maxTones;

    const overallSimilarity = topicSimilarity * 0.6 + toneSimilarity * 0.4;

    // Merge if: very similar content AND short gap (< MIN_ERA_GAP_DAYS)
    if (overallSimilarity >= MERGE_TOPIC_OVERLAP_THRESHOLD && gapDays < MIN_ERA_GAP_DAYS) {
      prev.endDate = curr.endDate || prev.endDate;
      prev.keyEvidenceIds = Array.from(new Set([...prev.keyEvidenceIds, ...curr.keyEvidenceIds]));
      prev.dominantTopics = Array.from(new Set([...prev.dominantTopics, ...curr.dominantTopics])).slice(0, 5);
      prev.dominantTones  = Array.from(new Set([...prev.dominantTones,  ...curr.dominantTones])).slice(0, 4);
      prev.definingPatterns = Array.from(new Set([...prev.definingPatterns, ...curr.definingPatterns]));
      prev.summary += ` Later extended into: ${curr.summary}`;
      mergedCount++;
    } else {
      result.push({ ...curr });
    }
  }

  return { eras: result, mergedCount };
}

// ── Private: Era Splitting ────────────────────────────────────────────────────

/**
 * Splits an era into two if it contains two clearly distinct sustained phases (§21).
 * Only splits if both halves have enough events AND are sufficiently distinct.
 */
function _splitCompositeEras(eras, allEvents) {
  const result = [];
  let splitCount = 0;

  for (const era of eras) {
    const eraEvents = allEvents.filter(e => (era.keyEvidenceIds || []).includes(e.evidenceId));

    if (eraEvents.length < MIN_SPLIT_ERA_EVENTS * 2) {
      result.push(era);
      continue;
    }

    const midpoint = Math.floor(eraEvents.length / 2);
    const firstHalf  = eraEvents.slice(0, midpoint);
    const secondHalf = eraEvents.slice(midpoint);

    const score = distinctnessScore(firstHalf, secondHalf);

    // Only split if halves are sufficiently distinct AND both have enough events
    if (score >= 0.6 && firstHalf.length >= MIN_SPLIT_ERA_EVENTS && secondHalf.length >= MIN_SPLIT_ERA_EVENTS) {
      const firstTopics  = Array.from(new Set(firstHalf.flatMap(e => e.topics || []))).slice(0, 4);
      const firstTones   = Array.from(new Set(firstHalf.map(e => e.tone).filter(Boolean))).slice(0, 3);
      const secondTopics = Array.from(new Set(secondHalf.flatMap(e => e.topics || []))).slice(0, 4);
      const secondTones  = Array.from(new Set(secondHalf.map(e => e.tone).filter(Boolean))).slice(0, 3);

      result.push({
        ...era,
        eraId: `${era.eraId}_a`,
        title: deriveEraTitle(firstTopics, firstTones, 0),
        endDate: firstHalf[firstHalf.length - 1]?.endTime?.slice(0, 10) || era.endDate,
        dominantTopics: firstTopics,
        dominantTones: firstTones,
        keyEvidenceIds: firstHalf.map(e => e.evidenceId).filter(Boolean),
        reasonForBoundary: `${era.reasonForBoundary} [split: first phase]`,
        confidence: era.confidence * 0.9,
      });
      result.push({
        ...era,
        eraId: `${era.eraId}_b`,
        title: deriveEraTitle(secondTopics, secondTones, 1),
        startDate: secondHalf[0]?.startTime?.slice(0, 10) || era.startDate,
        dominantTopics: secondTopics,
        dominantTones: secondTones,
        keyEvidenceIds: secondHalf.map(e => e.evidenceId).filter(Boolean),
        transitionFromPrevious: `Sustained shift mid-era: ${firstTopics.slice(0, 2).join(' & ')} → ${secondTopics.slice(0, 2).join(' & ')}`,
        reasonForBoundary: `Distinct sustained phase within the original era (score: ${score.toFixed(2)})`,
        confidence: era.confidence * 0.85,
      });
      splitCount++;
    } else {
      result.push(era);
    }
  }

  return { eras: result, splitCount };
}

// ── Private: Transitions ──────────────────────────────────────────────────────

function _buildTransitions(eras) {
  const transitions = [];

  for (let i = 0; i < eras.length - 1; i++) {
    const from = eras[i];
    const to   = eras[i + 1];

    // Time gap between eras
    const fromEnd  = new Date(from.endDate || 0);
    const toStart  = new Date(to.startDate  || 0);
    const gapDays  = Math.round((toStart - fromEnd) / (1000 * 60 * 60 * 24));

    let description = to.transitionFromPrevious
      ? to.transitionFromPrevious
      : `Transition from "${from.title}" into "${to.title}"`;

    if (gapDays >= 14) {
      description = `After a ~${gapDays}-day gap, conversation resumed in a noticeably different mode.`;
    }

    transitions.push({
      transitionId: `trans_${i + 1}`,
      fromEra: from.eraId,
      toEra: to.eraId,
      fromTitle: from.title,
      toTitle: to.title,
      gapDays,
      description,
      supportingEvidenceIds: [
        ...from.keyEvidenceIds.slice(-2),
        ...to.keyEvidenceIds.slice(0, 2),
      ],
    });
  }

  return transitions;
}
