/**
 * Plot Twist Detection Prompt — Gen-Z Documentary Drama Editor
 * Used for: detecting major behavioral/activity changes in the conversation.
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

export function buildPlotTwistsUserPrompt(memory, globalDiscovery, allMessages) {
  const changeMessages = allMessages.slice(0, 20).map(m => `[${m.id}] ${m.sender}: ${m.text}`);

  return `Major changes identified:
${JSON.stringify(globalDiscovery.majorChanges || [], null, 2)}

Chat memory periods:
${JSON.stringify(memory.periods.map(p => ({ dateRange: p.dateRange, messageCount: p.messageCount, topics: p.topics, tone: p.toneSignals })), null, 2)}

Sample messages for evidence:
${changeMessages.join('\n')}

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
