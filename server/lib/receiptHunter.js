/**
 * Receipt Hunter Engine — Phase 3/4 V2
 *
 * Dedicated verification, curation, and pairing engine.
 * Collects evidence from the Relationship Investigator and Evidence Store,
 * verifies every reference against the canonical message index,
 * and formats paired receipts (callbacks, contradictions, lore) for the Story Writer.
 */

/**
 * Curates and verifies top receipts from intelligence results and message index.
 *
 * @param {Object} intelligence - AfterchatIntelligence (with _investigatorResult and _evidenceStore)
 * @param {Map} [messageIndex] - Map of raw messages by ID (if available)
 * @param {number} [maxReceipts=20]
 * @returns {Object} Curated receipt catalog
 */
export function huntAndVerifyReceipts(intelligence, messageIndex = null, maxReceipts = 20) {
  const inv = intelligence?._investigatorResult || {};
  const store = intelligence?._evidenceStore || [];

  const verifiedMap = new Map();

  function verifyMessage(msgId, fallback = {}) {
    if (!msgId || typeof msgId !== 'string') return null;

    if (messageIndex && messageIndex.has(msgId)) {
      const real = messageIndex.get(msgId);
      return {
        messageId: msgId,
        sender: real.sender || fallback.sender || 'Unknown',
        timestamp: real.timestamp || fallback.timestamp || '',
        text: real.text ?? fallback.exactText ?? fallback.text ?? '',
      };
    }

    // If messageIndex not passed, use validated data from intelligence
    if (fallback && (fallback.exactText || fallback.text)) {
      return {
        messageId: msgId,
        sender: fallback.sender || 'Unknown',
        timestamp: fallback.timestamp || '',
        text: fallback.exactText || fallback.text || '',
      };
    }

    return null;
  }

  // 1. Process Callback Pairs (earlier + later)
  const callbackPairs = [];
  for (const cb of inv.callbacks || []) {
    const earlier = verifyMessage(cb.earlier?.messageId, cb.earlier);
    const later = verifyMessage(cb.later?.messageId, cb.later);
    if (earlier && later) {
      callbackPairs.push({
        earlier,
        later,
        connection: cb.connection || 'Thematic callback across time',
        confidence: cb.confidence ?? 0.9,
      });
      verifiedMap.set(earlier.messageId, { ...earlier, category: 'callback_earlier' });
      verifiedMap.set(later.messageId, { ...later, category: 'callback_later' });
    }
  }

  // 2. Process Contradiction Pairs (claim vs later reality)
  const contradictionPairs = [];
  for (const ct of inv.contradictions || []) {
    const evRefs = (ct.evidence || [])
      .map(e => verifyMessage(e?.messageId, e))
      .filter(Boolean);

    if (evRefs.length > 0) {
      contradictionPairs.push({
        claim: ct.claim,
        laterBehavior: ct.laterBehavior,
        explanation: ct.explanation,
        evidence: evRefs,
      });
      evRefs.forEach(ev => verifiedMap.set(ev.messageId, { ...ev, category: 'contradiction' }));
    }
  }

  // 3. Process Foreshadowing (setup + payoff)
  const foreshadowingPairs = [];
  for (const fs of inv.foreshadowing || []) {
    const setup = verifyMessage(fs.setup?.messageId, fs.setup);
    const payoff = verifyMessage(fs.payoff?.messageId, fs.payoff);
    if (setup && payoff) {
      foreshadowingPairs.push({
        setup,
        payoff,
        explanation: fs.explanation || 'Setup that paid off later',
      });
      verifiedMap.set(setup.messageId, { ...setup, category: 'foreshadowing_setup' });
      verifiedMap.set(payoff.messageId, { ...payoff, category: 'foreshadowing_payoff' });
    }
  }

  // 4. Process Lore Items
  const loreOrigins = [];
  for (const l of inv.lore || []) {
    const evRefs = (l.evidence || [])
      .map(e => verifyMessage(e?.messageId, e))
      .filter(Boolean);

    loreOrigins.push({
      name: l.name,
      origin: l.origin,
      howItEvolved: l.howItEvolved,
      evidence: evRefs,
    });
    evRefs.forEach(ev => verifiedMap.set(ev.messageId, { ...ev, category: 'lore' }));
  }

  // 5. Process Receipt Candidates from Investigator
  for (const rc of inv.receiptCandidates || []) {
    const verified = verifyMessage(rc.messageId, rc);
    if (verified && !verifiedMap.has(verified.messageId)) {
      verifiedMap.set(verified.messageId, {
        ...verified,
        category: 'receipt_candidate',
        reason: rc.reason,
        importance: rc.importance ?? 0.9,
      });
    }
  }

  // 6. Supplement from Evidence Store
  for (const ev of store) {
    if (verifiedMap.size >= maxReceipts) break;
    const verified = verifyMessage(ev.messageId, ev);
    if (verified && !verifiedMap.has(verified.messageId)) {
      verifiedMap.set(verified.messageId, {
        ...verified,
        category: ev.type || 'memorable',
        reason: ev.connection || ev.reason || '',
        importance: ev.importance ?? 0.8,
      });
    }
  }

  const allVerifiedReceipts = Array.from(verifiedMap.values());

  return {
    receipts: allVerifiedReceipts,
    callbackPairs,
    contradictionPairs,
    foreshadowingPairs,
    loreOrigins,
  };
}

/**
 * Format curated receipts into structured text for the Story Writer prompt.
 *
 * @param {Object} catalog - Output from huntAndVerifyReceipts
 * @returns {string}
 */
export function formatReceiptsForStoryPrompt(catalog) {
  const sections = [];

  // Callbacks
  if (catalog.callbackPairs?.length > 0) {
    const cbLines = catalog.callbackPairs.slice(0, 5).map((cb, idx) => {
      const ts1 = cb.earlier.timestamp ? cb.earlier.timestamp.slice(0, 10) : 'Earlier';
      const ts2 = cb.later.timestamp ? cb.later.timestamp.slice(0, 10) : 'Later';
      return (
        `  Pair #${idx + 1} [${cb.connection}]:\n` +
        `    EARLIER [${cb.earlier.messageId}] (${ts1}, ${cb.earlier.sender}): "${cb.earlier.text}"\n` +
        `    LATER   [${cb.later.messageId}] (${ts2}, ${cb.later.sender}): "${cb.later.text}"`
      );
    });
    sections.push(`VERIFIED CALLBACK PAIRS (Echoes across time — quote both):\n${cbLines.join('\n\n')}`);
  }

  // Contradictions
  if (catalog.contradictionPairs?.length > 0) {
    const ctLines = catalog.contradictionPairs.slice(0, 4).map((ct, idx) => {
      const evList = ct.evidence.map(e => `    [${e.messageId}] ${e.sender}: "${e.text}"`).join('\n');
      return (
        `  Contradiction #${idx + 1}:\n` +
        `    CLAIM: "${ct.claim}" vs LATER REALITY: "${ct.laterBehavior}"\n` +
        `    EXPLANATION: ${ct.explanation}\n` +
        `    EVIDENCE:\n${evList}`
      );
    });
    sections.push(`VERIFIED CONTRADICTIONS (Claim vs Reality — highlight in story):\n${ctLines.join('\n\n')}`);
  }

  // Foreshadowing
  if (catalog.foreshadowingPairs?.length > 0) {
    const fsLines = catalog.foreshadowingPairs.slice(0, 3).map((fs, idx) => {
      return (
        `  Foreshadowing #${idx + 1} (${fs.explanation}):\n` +
        `    SETUP  [${fs.setup.messageId}] ${fs.setup.sender}: "${fs.setup.text}"\n` +
        `    PAYOFF [${fs.payoff.messageId}] ${fs.payoff.sender}: "${fs.payoff.text}"`
      );
    });
    sections.push(`FORESHADOWING MOMENTS (Accidental predictions):\n${fsLines.join('\n\n')}`);
  }

  // Lore
  if (catalog.loreOrigins?.length > 0) {
    const loreLines = catalog.loreOrigins.slice(0, 5).map((l, idx) => {
      const ev = l.evidence?.length > 0 ? ` [${l.evidence[0].messageId}] "${l.evidence[0].text}"` : '';
      return `  #${idx + 1} "${l.name}": Origin: ${l.origin} → Evolution: ${l.howItEvolved}${ev}`;
    });
    sections.push(`CONVERSATION LORE & MYTHOLOGY:\n${loreLines.join('\n')}`);
  }

  // Key Individual Receipts
  const individualReceipts = (catalog.receipts || [])
    .slice(0, 15)
    .map(r => {
      const ts = r.timestamp ? r.timestamp.replace('T', ' ').slice(0, 16) : '';
      return `[${r.messageId}] ${ts} | ${r.sender}: "${r.text}" (${r.category || 'receipt'})`;
    });

  if (individualReceipts.length > 0) {
    sections.push(`INDISPENSABLE MESSAGE RECEIPTS:\n${individualReceipts.join('\n')}`);
  }

  return sections.join('\n\n═══════════════════════════════════════════════════\n\n');
}
