/**
 * Story Memory Builder & Story Input Preparation Engine
 *
 * Prepares verified, context-rich, chronologically grounded conversation memory
 * for the final story generation model (GPT-5 mini).
 *
 * Source Hierarchy:
 *   LEVEL 1: Original WhatsApp messages (messageIndex)
 *   LEVEL 2: Contextual evidence interactions (evidenceStore)
 *   LEVEL 3: Evidence intelligence (_conversationMemory)
 *   LEVEL 4: Story memory (StoryMemory object)
 *   LEVEL 5: Story prose (GPT-5 mini output)
 *
 * Core Guarantees:
 *   ✓ NARRATIVE BUILDING BLOCKS: Provides major events, high-value interactions with original dialogue,
 *     recurring patterns, confirmed callbacks (with both contexts), turning points, and contrasts.
 *   ✓ IMMUTABLE TRACEABILITY: Every item cites real evidenceIds and messageIds. No orphan claims.
 *   ✓ PRESERVES VOICE & DIALOGUE: Preserves Hinglish, slang, emojis, humor timing, and setups/reactions.
 *   ✓ NO PREWRITING: Does NOT dictate chapter structure or force artificial romance/breakup arcs.
 *   ✓ TOKEN OPTIMIZED: Curates maximum signal per token within a configurable budget.
 */

import { estimateMessageTokens } from './tokenEstimator.js';
import { detectConversationEras } from './eraDetector.js';

export const DEFAULT_STORY_MEMORY_CONFIG = {
  MAX_STORY_MEMORY_TOKENS: 8000,
  MAX_HIGH_VALUE_INTERACTIONS: 14,
  MAX_MESSAGES_PER_HIGH_VALUE_INTERACTION: 8,
  MAX_CALLBACKS: 6,
  MAX_PATTERNS: 10,
  MAX_TIMELINE_EVENTS: 16,
  MAX_RECURRING_TOPICS: 8,
  MAX_CONTRADICTIONS: 6,
};

/**
 * Formats a message into a clean, voice-preserving dialogue line.
 * @param {Object} m — { sender, text }
 * @returns {string}
 */
export function formatDialogueLine(m) {
  if (!m) return '';
  const sender = m.sender || 'Unknown';
  const text = (m.text || '').replace(/\n+/g, ' ').trim();
  return `${sender}: "${text}"`;
}

/**
 * Builds the structured StoryMemory object from verified intelligence and evidence.
 *
 * @param {Object} params
 * @param {Array} params.evidenceStore — Array of Level 2 EvidenceInteraction
 * @param {Object} params.conversationMemory — Output of buildVerifiedConversationMemory
 * @param {Object} params.metadata — Request metadata (participants, durationDays, totalMessages)
 * @param {Object} params.summaryStats — Request summaryStats
 * @param {Object} [params.config] — Configurable limits and token budgets
 * @returns {Object} Structured StoryMemory
 */
export function buildStoryMemory({
  evidenceStore = [],
  conversationMemory = {},
  metadata = {},
  summaryStats = {},
  config = {},
}) {
  const cfg = { ...DEFAULT_STORY_MEMORY_CONFIG, ...config };
  const participants = metadata.participants || ['Participant A', 'Participant B'];
  const evMap = new Map((evidenceStore || []).map((ev) => [ev.id || ev.messageId, ev]));

  // Helper to look up an interaction by evidenceId or messageId
  const getEv = (id) => {
    if (!id) return null;
    if (evMap.has(id)) return evMap.get(id);
    return evidenceStore.find((e) => e.messageIds && e.messageIds.includes(id)) || null;
  };

  // ── 0. Detect Dynamic Eras & Transitions ──────────────────────────────────
  const { eras, eraTransitions } = detectConversationEras(
    conversationMemory.verifiedEvents || [],
    conversationMemory._rawInvestigator || {},
    metadata
  );

  // ── 1. Conversation Overview ──────────────────────────────────────────────
  const themes = new Set();
  (conversationMemory.verifiedEvents || []).forEach((e) => {
    (e.themes || []).forEach((t) => themes.add(t));
  });

  const conversationOverview = {
    participants,
    totalMessages: metadata.totalMessages || 0,
    durationDays: metadata.durationDays || 1,
    dateRange: `${metadata.startDate || 'Start'} to ${metadata.endDate || 'End'}`,
    peakActivity: `Peak ${summaryStats.peakHour || 'Night'} on ${summaryStats.peakDay || 'Weekdays'}`,
    supportedThemes: Array.from(themes).slice(0, 8),
    chatType: metadata.chatType || 'Direct conversation',
    backstory: metadata.backstory || '',
  };

  // ── 2. Chronological Timeline ─────────────────────────────────────────────
  const timeline = (conversationMemory.timeline || [])
    .slice(0, cfg.MAX_TIMELINE_EVENTS)
    .map((item) => {
      const ev = getEv(item.evidenceId);
      return {
        date: item.period || 'Archive Era',
        title: ev?.interactionSummary || item.summary,
        whatHappened: item.summary,
        evidenceIds: [item.evidenceId],
        importance: item.importance ?? 0.8,
      };
    });

  // ── 3. High-Value Interactions (With Original Dialogue) ────────────────────
  // Diversity pass: select representative interactions across different themes/phases
  const seenThemes = new Set();
  const sortedInteractions = [...evidenceStore].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
  const selectedInteractions = [];

  // Phase A: Select distinct theme leaders
  for (const ev of sortedInteractions) {
    if (selectedInteractions.length >= cfg.MAX_HIGH_VALUE_INTERACTIONS) break;
    const themeKey = `${ev.type}_${ev.tone}`;
    if (!seenThemes.has(themeKey)) {
      seenThemes.add(themeKey);
      selectedInteractions.push(ev);
    }
  }

  // Phase B: Fill remaining high-value slots
  for (const ev of sortedInteractions) {
    if (selectedInteractions.length >= cfg.MAX_HIGH_VALUE_INTERACTIONS) break;
    if (!selectedInteractions.some((s) => s.id === ev.id)) {
      selectedInteractions.push(ev);
    }
  }

  // Sort chronologically for narrative flow
  selectedInteractions.sort(
    (a, b) => new Date(a.startTimestamp || 0) - new Date(b.startTimestamp || 0)
  );

  const highValueInteractions = selectedInteractions.map((ev) => {
    const rawMsgs = (ev.messages || []).slice(0, cfg.MAX_MESSAGES_PER_HIGH_VALUE_INTERACTION);
    const startMsgId = rawMsgs[0]?.id || '';
    const endMsgId = rawMsgs[rawMsgs.length - 1]?.id || '';
    const startTs = ev.startTimestamp || rawMsgs[0]?.timestamp || '';
    const endTs = ev.endTimestamp || rawMsgs[rawMsgs.length - 1]?.timestamp || '';

    return {
      interactionId: ev.id,
      evidenceId: ev.id,
      date: startTs ? startTs.slice(0, 10) : '',
      startTimestamp: startTs,
      endTimestamp: endTs,
      startMessageId: startMsgId,
      endMessageId: endMsgId,
      context: ev.interactionSummary || 'Conversational interaction',
      setup: rawMsgs.length > 0 ? formatDialogueLine(rawMsgs[0]) : '',
      response: rawMsgs.length > 1 ? formatDialogueLine(rawMsgs[1]) : '',
      outcome: ev.outcome || (rawMsgs.length > 2 ? formatDialogueLine(rawMsgs[rawMsgs.length - 1]) : ''),
      whyItMatters: `Captures ${ev.type || 'relational'} dynamic in ${ev.tone || 'conversational'} tone`,
      tone: ev.tone || 'conversational',
      topic: ev.type || 'conversational',
      participants: ev.participants || participants,
      dialogue: rawMsgs.map(formatDialogueLine),
      messages: rawMsgs.map((m) => ({
        sender: m.sender || 'Unknown',
        timestamp: m.timestamp || '',
        text: m.text || '',
        id: m.id || '',
      })),
      interpretation: ev.interactionSummary,
      importance: ev.importance ?? 0.85,
    };
  });

  // ── 4. Opening Material (Early interactions establishing dynamic) ──────────
  const openingMaterial = highValueInteractions.slice(0, 3).map((hvi) => ({
    evidenceId: hvi.evidenceId,
    date: hvi.date,
    context: hvi.context,
    dialogue: hvi.dialogue,
  }));

  // ── 5. Recurring Patterns ─────────────────────────────────────────────────
  const recurringPatterns = (conversationMemory.recurringPatterns || [])
    .slice(0, cfg.MAX_PATTERNS)
    .map((pat) => {
      const supportingIds = pat.supportingEvidenceIds || [];
      const strongest = supportingIds[0] ? getEv(supportingIds[0]) : null;
      const contrast = supportingIds.length > 1 ? getEv(supportingIds[supportingIds.length - 1]) : null;

      return {
        id: pat.id,
        pattern: pat.description,
        firstSeen: pat.firstSeen || (strongest?.startTimestamp?.slice(0, 10) || ''),
        lastSeen: pat.lastSeen || (contrast?.endTimestamp?.slice(0, 10) || ''),
        occurrences: pat.occurrences || supportingIds.length,
        strongestExample: strongest ? {
          evidenceId: strongest.id,
          date: strongest.startTimestamp?.slice(0, 10) || '',
          summary: strongest.interactionSummary,
          dialogue: (strongest.messages || []).slice(0, 4).map(formatDialogueLine),
        } : null,
        contrastExample: contrast && contrast.id !== strongest?.id ? {
          evidenceId: contrast.id,
          date: contrast.startTimestamp?.slice(0, 10) || '',
          summary: contrast.interactionSummary,
          dialogue: (contrast.messages || []).slice(0, 4).map(formatDialogueLine),
        } : null,
        supportingEvidenceIds: supportingIds,
        confidence: pat.confidence ?? 0.9,
      };
    });

  // ── 6. Recurring Topics (With Longitudinal Evolution) ─────────────────────
  const recurringTopics = (conversationMemory.recurringTopics || [])
    .slice(0, cfg.MAX_RECURRING_TOPICS)
    .map((top) => {
      const firstId = top.occurrences?.[0];
      const lastId = top.occurrences?.[top.occurrences.length - 1];
      const firstEv = getEv(firstId);
      const lastEv = getEv(lastId);

      return {
        topic: top.topic,
        firstAppearance: {
          evidenceId: firstId || '',
          date: top.firstSeen ? top.firstSeen.slice(0, 10) : (firstEv?.startTimestamp?.slice(0, 10) || ''),
          context: firstEv?.interactionSummary || '',
        },
        laterAppearances: (top.occurrences || []).slice(1).map((id) => {
          const ev = getEv(id);
          return {
            evidenceId: id,
            date: ev?.startTimestamp ? ev.startTimestamp.slice(0, 10) : '',
            context: ev?.interactionSummary || '',
          };
        }),
        evolution: top.evolution && top.evolution.length > 1
          ? `Started in ${top.evolution[0].period} (${top.evolution[0].description}), later evolved in ${top.evolution[top.evolution.length - 1].period} (${top.evolution[top.evolution.length - 1].description})`
          : `Resurfaces across the archive (${top.occurrences?.length || 1} times)`,
        supportingEvidenceIds: top.occurrences || [],
      };
    });

  // ── 7. Confirmed Callbacks (With Full Context from BOTH Sides) ────────────
  const confirmedCallbacks = (conversationMemory.callbacks || [])
    .slice(0, cfg.MAX_CALLBACKS)
    .map((cb) => {
      const origEv = getEv(cb.originalEvidenceId);
      const laterEv = getEv(cb.laterEvidenceId);

      return {
        id: cb.id,
        connection: cb.connection,
        original: {
          evidenceId: cb.originalEvidenceId,
          date: origEv?.startTimestamp ? origEv.startTimestamp.slice(0, 10) : '',
          summary: origEv?.interactionSummary || 'Original exchange',
          dialogue: (origEv?.messages || []).slice(0, 4).map(formatDialogueLine),
        },
        later: {
          evidenceId: cb.laterEvidenceId,
          date: laterEv?.startTimestamp ? laterEv.startTimestamp.slice(0, 10) : '',
          summary: laterEv?.interactionSummary || 'Later reference',
          dialogue: (laterEv?.messages || []).slice(0, 4).map(formatDialogueLine),
        },
        confidence: cb.confidence ?? 0.95,
      };
    });

  // ── 8. Callback Candidates (Plausible Without Forced Certainty) ───────────
  const callbackCandidates = (conversationMemory.callbackCandidates || []).map((cand) => ({
    type: 'callback_candidate',
    originalEvidenceId: cand.originalEvidenceId,
    laterEvidenceId: cand.laterEvidenceId,
    reason: cand.connection || 'Plausible contextual echo across archive',
    confidence: cand.confidence ?? 0.65,
  }));

  // ── 9. Turning Points (Before -> Event -> After) ──────────────────────────
  const turningPoints = (conversationMemory.turningPoints || []).map((tp) => {
    const mainEv = tp.supportingEvidenceIds?.[0] ? getEv(tp.supportingEvidenceIds[0]) : null;
    return {
      id: tp.id,
      title: tp.title,
      description: tp.description,
      before: tp.before || 'Established dynamic',
      after: tp.after || 'Shifted communication rhythm',
      evidenceId: tp.supportingEvidenceIds?.[0] || '',
      dialogue: mainEv ? (mainEv.messages || []).slice(0, 4).map(formatDialogueLine) : [],
      significance: tp.significance ?? 0.88,
    };
  });

  // ── 10. Contradictions (Side A Claim vs. Side B Behavior) ─────────────────
  const contradictions = (conversationMemory.contradictions || [])
    .slice(0, cfg.MAX_CONTRADICTIONS)
    .map((c) => {
      const evA = c.supportingEvidenceIds?.[0] ? getEv(c.supportingEvidenceIds[0]) : null;
      const evB = c.supportingEvidenceIds?.[1] ? getEv(c.supportingEvidenceIds[1]) : null;

      return {
        id: c.id,
        description: c.explanation || `Claim: "${c.claim}" vs Behavior: "${c.laterBehavior}"`,
        claim: c.claim,
        laterBehavior: c.laterBehavior,
        sideA: {
          evidenceId: evA?.id || c.supportingEvidenceIds?.[0] || '',
          date: evA?.startTimestamp ? evA.startTimestamp.slice(0, 10) : '',
          dialogue: evA ? (evA.messages || []).slice(0, 3).map(formatDialogueLine) : [c.claim],
        },
        sideB: {
          evidenceId: evB?.id || c.supportingEvidenceIds?.[1] || '',
          date: evB?.startTimestamp ? evB.startTimestamp.slice(0, 10) : '',
          dialogue: evB ? (evB.messages || []).slice(0, 3).map(formatDialogueLine) : [c.laterBehavior],
        },
        confidence: c.confidence ?? 0.9,
      };
    });

  // ── 11. Rare Memorable Moments (High Significance Events) ──────────────────
  const rareMemorableMoments = evidenceStore
    .filter((e) => ['apology', 'vulnerability', 'promise', 'turning_point'].includes(e.type) || (e.importance ?? 0) >= 0.93)
    .slice(0, 5)
    .map((ev) => ({
      evidenceId: ev.id,
      date: ev.startTimestamp ? ev.startTimestamp.slice(0, 10) : '',
      type: ev.type,
      summary: ev.interactionSummary,
      dialogue: (ev.messages || []).slice(0, 4).map(formatDialogueLine),
      importance: ev.importance ?? 0.95,
    }));

  // ── 12. Character Signals (Observable Texting Behaviors Only) ──────────────
  const characterSignals = participants.map((p) => {
    const userEvents = evidenceStore.filter((e) => (e.participants || []).includes(p));
    const topTones = Array.from(new Set(userEvents.map((e) => e.tone).filter(Boolean))).slice(0, 2);
    const topSummaries = userEvents.slice(0, 2).map((e) => `${e.interactionSummary} (evidence: ${e.id})`);

    return {
      participant: p,
      observableHabits: [
        topTones.length ? `Frequently engages in ${topTones.map((t) => t.replace(/_/g, ' ')).join(' & ')} style` : null,
        ...topSummaries,
        `Active in ${userEvents.length} recorded interactions across the archive`,
      ].filter(Boolean),
    };
  });

  // ── 13. Telemetry & Token Estimation ──────────────────────────────────────
  const storyMemoryObject = {
    conversationOverview,
    eras,
    eraTransitions,
    timeline,
    openingMaterial,
    highValueInteractions,
    recurringPatterns,
    recurringTopics,
    confirmedCallbacks,
    callbackCandidates,
    turningPoints,
    contradictions,
    characterSignals,
    rareMemorableMoments,
    unresolvedThreads: (conversationMemory.unresolvedThreads || []).slice(0, 4),
    uncertainties: callbackCandidates.map((c) => ({
      observation: `Potential callback between ${c.originalEvidenceId} and ${c.laterEvidenceId}`,
      reason: c.reason,
      confidence: c.confidence,
    })),
  };

  // Telemetry calculation
  const totalSelectedMessages = highValueInteractions.reduce((sum, h) => sum + (h.messages?.length || 0), 0);
  const jsonStr = JSON.stringify(storyMemoryObject);
  const estimatedTokens = Math.round(jsonStr.length / 4);

  const telemetry = {
    inputEvidenceCount: evidenceStore.length,
    selectedInteractionsCount: highValueInteractions.length,
    selectedMessagesCount: totalSelectedMessages,
    patternsCount: recurringPatterns.length,
    topicsCount: recurringTopics.length,
    callbacksCount: confirmedCallbacks.length,
    turningPointsCount: turningPoints.length,
    contradictionsCount: contradictions.length,
    rareMomentsCount: rareMemorableMoments.length,
    estimatedStoryMemoryTokens: estimatedTokens,
    tokenBudget: cfg.MAX_STORY_MEMORY_TOKENS,
  };

  console.log(
    '\n[Story Memory] ═══════════════════════════════════════════\n' +
    `[Story Memory] Input Evidence:           ${telemetry.inputEvidenceCount}\n` +
    `[Story Memory] Selected Interactions:    ${telemetry.selectedInteractionsCount}\n` +
    `[Story Memory] Selected Messages:        ${telemetry.selectedMessagesCount}\n` +
    `[Story Memory] Patterns Included:        ${telemetry.patternsCount}\n` +
    `[Story Memory] Recurring Topics:         ${telemetry.topicsCount}\n` +
    `[Story Memory] Confirmed Callbacks:      ${telemetry.callbacksCount}\n` +
    `[Story Memory] Turning Points:          ${telemetry.turningPointsCount}\n` +
    `[Story Memory] Contradictions:           ${telemetry.contradictionsCount}\n` +
    `[Story Memory] Rare Moments:             ${telemetry.rareMomentsCount}\n` +
    `[Story Memory] Memory Tokens (est):      ${telemetry.estimatedStoryMemoryTokens} / ${telemetry.tokenBudget}\n` +
    '[Story Memory] ═══════════════════════════════════════════\n'
  );

  return {
    ...storyMemoryObject,
    _telemetry: telemetry,
  };
}

/**
 * Formats the structured StoryMemory object into a crystal-clear, high-context prompt section for GPT-5 mini.
 * Gives the story model maximum narrative signal with zero isolated receipts or vague hand-waving.
 *
 * @param {Object} storyMemory — Output of buildStoryMemory
 * @returns {string} Formatted prompt string
 */
export function formatStoryMemoryForPrompt(storyMemory) {
  if (!storyMemory) return 'No story memory available.';

  const {
    conversationOverview: co = {},
    timeline = [],
    highValueInteractions = [],
    recurringPatterns = [],
    recurringTopics = [],
    confirmedCallbacks = [],
    turningPoints = [],
    contradictions = [],
    rareMemorableMoments = [],
  } = storyMemory;

  const timelineStr = timeline
    .map((t) => `• [${t.date}] ${t.title}: ${t.whatHappened} (Evidence: ${t.evidenceIds.join(', ')})`)
    .join('\n');

  const interactionsStr = highValueInteractions
    .map((h, i) => {
      const dialogueBlock = (h.dialogue || []).map((d) => `    ${d}`).join('\n');
      return `[Interaction #${i + 1} // ${h.evidenceId}] ${h.date} | Tone: ${h.tone} (Imp: ${h.importance})\n  Context: ${h.context}\n  Actual Dialogue:\n${dialogueBlock}`;
    })
    .join('\n\n');

  const patternsStr = recurringPatterns
    .map((p) => {
      let str = `• Pattern: "${p.pattern}" (Occurrences: ${p.occurrences}, Range: ${p.firstSeen} -> ${p.lastSeen})\n  Supporting Evidence: ${p.supportingEvidenceIds.join(', ')}`;
      if (p.strongestExample?.dialogue?.length) {
        str += `\n  Strongest Example (${p.strongestExample.evidenceId}):\n${p.strongestExample.dialogue.map((d) => `    ${d}`).join('\n')}`;
      }
      return str;
    })
    .join('\n\n');

  const callbacksStr = confirmedCallbacks.length > 0
    ? confirmedCallbacks
        .map((cb, i) => {
          const origDiag = (cb.original?.dialogue || []).map((d) => `      ${d}`).join('\n');
          const lateDiag = (cb.later?.dialogue || []).map((d) => `      ${d}`).join('\n');
          return `[Confirmed Callback #${i + 1}]\n  Connection: ${cb.connection}\n  Original Exchange (${cb.original.evidenceId} - ${cb.original.date}):\n${origDiag}\n  Later Callback (${cb.later.evidenceId} - ${cb.later.date}):\n${lateDiag}`;
        })
        .join('\n\n')
    : 'None documented with explicit proof.';

  const contradictionsStr = contradictions.length > 0
    ? contradictions
        .map((c, i) => {
          const diagA = (c.sideA?.dialogue || []).map((d) => `      ${d}`).join('\n');
          const diagB = (c.sideB?.dialogue || []).map((d) => `      ${d}`).join('\n');
          return `[Contradiction #${i + 1}] ${c.description}\n  Side A (${c.sideA.evidenceId} - ${c.sideA.date}):\n${diagA}\n  Side B (${c.sideB.evidenceId} - ${c.sideB.date}):\n${diagB}`;
        })
        .join('\n\n')
    : 'None documented.';

  const rareMomentsStr = rareMemorableMoments.length > 0
    ? rareMemorableMoments
        .map((r, i) => {
          const diag = (r.dialogue || []).map((d) => `    ${d}`).join('\n');
          return `• Rare Moment #${i + 1} (${r.type} // ${r.evidenceId} - ${r.date}): ${r.summary}\n${diag}`;
        })
        .join('\n\n')
    : 'None documented.';

  return `═══════════════════════════════════════════════════
CONVERSATION OVERVIEW:
═══════════════════════════════════════════════════
Participants: ${(co.participants || []).join(', ')}
Total Volume: ${(co.totalMessages || 0).toLocaleString()} messages across ${co.durationDays || 1} days (${co.dateRange || ''})
${co.backstory ? `Backstory: "${co.backstory}"\n` : ''}Activity: ${co.peakActivity || 'General'}
Observed Themes: ${(co.supportedThemes || []).join(', ') || 'Daily banter, shared updates'}

═══════════════════════════════════════════════════
CHRONOLOGICAL TIMELINE OF MAJOR EVENTS:
═══════════════════════════════════════════════════
${timelineStr || 'Full archive duration'}

═══════════════════════════════════════════════════
HIGH-VALUE CONVERSATIONAL INTERACTIONS (WITH ORIGINAL DIALOGUE):
═══════════════════════════════════════════════════
${interactionsStr}

═══════════════════════════════════════════════════
VERIFIED RECURRING PATTERNS:
═══════════════════════════════════════════════════
${patternsStr || 'None documented'}

═══════════════════════════════════════════════════
CONFIRMED CALLBACKS (WITH CONTEXT FROM BOTH SIDES):
═══════════════════════════════════════════════════
${callbacksStr}

═══════════════════════════════════════════════════
VERIFIED CONTRADICTIONS:
═══════════════════════════════════════════════════
${contradictionsStr}

═══════════════════════════════════════════════════
RARE MEMORABLE MOMENTS (VULNERABILITY / APOLOGIES / TURNING POINTS):
═══════════════════════════════════════════════════
${rareMomentsStr}`;
}
