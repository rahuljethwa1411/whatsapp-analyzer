/**
 * Plot Twist Detection Prompt — Gen-Z Documentary Drama Editor
 * Updated to use CompactChatMemory instead of raw allMessages.
 */

export function buildPlotTwistsSystemPrompt() {
  return `You are the drama editor for AfterChat — a viral documentary series investigating WhatsApp chat exports.

Your task: detect the sudden twists, turnarounds, ghosting spells, activity explosions, or tone shifts in the conversation.

DRAMA EDITOR MINDSET:
- Group chats and private chats have pivot points — the moment everything changed.
- Look for sudden silences: "After 4,000 messages in 2 months, complete radio silence for 21 days."
- Look for sudden activity spikes: "Average 5 messages/day suddenly shoots to 400 messages/day in 24 hours."
- Look for radical tone shifts: "The chat went from formal assignment coordination to unhinged 3 AM life debriefs."

RULES:
1. Only describe observable changes grounded in data. Do NOT invent psychological causes.
2. Use objective phrasing: "Activity shifted around [Date]" rather than speculative claims ("They had a fight").
3. Use actual evidence message IDs from the input.
4. significance reflects how dramatic the shift was (0.0 - 1.0).
5. beforePeriod and afterPeriod should be date-based descriptions.
6. Return JSON only.

GREAT PLOT TWIST EXAMPLES:
- "The 3-Week Radio Silence (From 100 msgs/day to absolute silence)"
- "The Exam Season Surge (Volume increased by 400% overnight)"
- "The Late-Night Vibe Shift (Logistics turned into emotional confessions at 1:45 AM)"`;
}

/**
 * @param {Object} compactMemory  — CompactChatMemory
 * @param {Object} globalDiscovery — GlobalDiscovery result
 */
export function buildPlotTwistsUserPrompt(compactMemory, globalDiscovery) {
  // Use relationship changes from patterns as evidence
  const relationshipChanges = compactMemory.globalPatterns || [];
  const allEvidenceIds = [
    ...relationshipChanges.flatMap(r => r.messageIds || []),
    ...(compactMemory.globalEvents || []).flatMap(e => e.messageIds || []),
  ].slice(0, 40);

  return `Major changes identified:
${JSON.stringify(globalDiscovery.majorChanges || [], null, 2)}

Chat memory periods (message counts and topics):
${JSON.stringify(
    (compactMemory.periods || []).map(p => ({
      dateRange: p.dateRange,
      messageCount: p.messageCount,
      topics: p.topics,
    })),
    null,
    2
  )}

Observable relationship/tone changes:
${JSON.stringify(relationshipChanges.slice(0, 10), null, 2)}

Available evidence message IDs (only use these):
${allEvidenceIds.join(', ')}

Identify 1-4 plot twists. Return JSON:
{
  "plotTwists": [
    {
      "id": "twist_1",
      "title": "Dramatic plot twist title",
      "description": "Factual 1-2 sentence description of the shift",
      "beforePeriod": "date range before shift",
      "afterPeriod": "date range after shift",
      "significance": 0.0-1.0,
      "evidenceMessageIds": ["msg_X"]
    }
  ]
}`;
}
