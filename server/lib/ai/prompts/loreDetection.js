/**
 * Lore Detection Prompt — Gen-Z Documentary Archaeologist
 * Updated to use CompactChatMemory instead of raw chunkInsights + allMessages.
 * This ensures the 70B model NEVER receives the full raw message list.
 */

export function buildLoreDetectionSystemPrompt() {
  return `You are the lead lore archaeologist for AfterChat — a viral documentary series investigating WhatsApp exports.

Your task: dig up the legendary lore items, inside jokes, unhinged statements, accidental comedy, and iconic chat moments that participants will re-share and laugh about.

ARCHAEOLOGIST MINDSET:
- Lore is what makes a chat unique to those specific people.
- Look for inside jokes, misread texts, absurd autocorrect fails, midnight confessions, recurring meme formats, or legendary debates.
- Titles must be specific to this exact chat (e.g. "The 3 AM Maggi Incident" instead of "Funny Joke").

RULES:
1. Humor must come directly from real evidence in the compact memory. Never fabricate context.
2. Every lore item MUST have real evidenceMessageIds (only IDs mentioned in the evidence you were given).
3. Titles must be hyper-specific to the actual chat content.
4. Keep descriptions grounded and factual — Phase 4 story engine handles the comedic narration.
5. funnyScore reflects comedic value (0.0 - 1.0).
6. importance reflects how foundational this moment is to the chat's internal mythology (0.0 - 1.0).
7. Only use message IDs present in the input.
8. Return JSON only.`;
}

/**
 * @param {Object} compactMemory — CompactChatMemory
 */
export function buildLoreDetectionUserPrompt(compactMemory) {
  const moments = compactMemory.globalMoments || [];
  const events = compactMemory.globalEvents || [];
  const themes = compactMemory.recurringThemes || [];

  // Collect evidence IDs referenced in memory for the model to use
  const allEvidenceIds = [
    ...moments.flatMap(m => m.messageIds || []),
    ...events.flatMap(e => e.messageIds || []),
  ].slice(0, 60);

  return `Notable moments found across the conversation:
${JSON.stringify(moments.slice(0, 20), null, 2)}

Notable events:
${JSON.stringify(events.slice(0, 12), null, 2)}

Recurring themes and phrases: ${themes.slice(0, 15).join(', ')}

Available evidence message IDs (only use these):
${allEvidenceIds.join(', ')}

Unearth 3-8 memorable lore items. Return JSON:
{
  "lore": [
    {
      "id": "lore_1",
      "title": "Specific, memorable lore title",
      "description": "What happened and why it's legendary (factual, 1-2 sentences)",
      "date": "approximate date string",
      "participants": ["Name1"],
      "funnyScore": 0.0-1.0,
      "importance": 0.0-1.0,
      "evidenceMessageIds": ["msg_X"]
    }
  ]
}`;
}
