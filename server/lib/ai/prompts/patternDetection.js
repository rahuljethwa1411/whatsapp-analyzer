/**
 * Pattern Detection Prompt — Gen-Z Documentary Behavioral Analyst
 * Updated to use CompactChatMemory instead of raw chunkInsights.
 */

export function buildPatternDetectionSystemPrompt() {
  return `You are a behavioral pattern analyst for AfterChat — a viral documentary series investigating WhatsApp exports.

Your task: identify recurring behavioral loops in the chat — repeated rituals, running catchphrases, failed plans, late-night text dumps, and predictable group dynamics.

ANALYST MINDSET:
- Human texting habits are wildly predictable when viewed in aggregate.
- Find patterns like: "Person A asks a serious question, Person B replies with a meme, conversation devolves into chaos."
- Look for failed plan patterns: "Plans proposed 14 times, execution rate 0%."
- Look for late-night habits: "Conversations that start with 'u up?' at 1:30 AM and end at 4:00 AM."

RULES:
1. STRICT UNBIASED PATTERN DETECTION: Identify ONLY patterns that are explicitly grounded in the memory data. Do NOT default to trip planning or generic vacation tropes unless explicitly present.
2. Patterns must repeat at least twice to qualify.
3. frequency is the estimated number of occurrences.
4. importance reflects how defining the pattern is for the chat's dynamic (0.0 - 1.0).
5. Use only real message IDs from the input.
6. Return JSON only.

GREAT PATTERN EXAMPLES:
- "The 2 AM Late-Night Text Loop"
- "The Unprompted Link/Meme Drop That Derails Discussion"
- "The Single-Word Acknowledgment Trap ('k', 'cool', 'thumbs up')"
- "The Match Day Debrief Ritual"`;
}

/**
 * @param {Object} compactMemory — CompactChatMemory
 */
export function buildPatternDetectionUserPrompt(compactMemory) {
  const allTopics = compactMemory.globalTopics || [];
  const allThemes = compactMemory.recurringThemes || [];
  const patterns = compactMemory.globalPatterns || [];
  const allEvidenceIds = patterns.flatMap(p => p.messageIds || []).slice(0, 40);

  return `Recurring themes: ${allThemes.slice(0, 20).join(', ')}

All topics across conversation: ${allTopics.slice(0, 30).join(', ')}

Observed behavioral patterns from extraction:
${JSON.stringify(patterns.slice(0, 15), null, 2)}

Chat memory periods (topic distribution over time):
${JSON.stringify(
    (compactMemory.periods || []).map(p => ({
      dateRange: p.dateRange,
      topics: p.topics.slice(0, 5),
    })),
    null,
    2
  )}

Available evidence message IDs (only use these):
${allEvidenceIds.join(', ')}

Identify 3-6 meaningful behavioral patterns. Return JSON:
{
  "patterns": [
    {
      "id": "pattern_1",
      "title": "Specific, witty pattern title",
      "description": "What happens and how often (factual, 1-2 sentences)",
      "frequency": estimated_count_number,
      "importance": 0.0-1.0,
      "evidenceMessageIds": []
    }
  ]
}`;
}
