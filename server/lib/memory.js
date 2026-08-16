/**
 * Chat Memory Builder
 * Consolidates chunk insights into a compact, deduplicated ChatMemory.
 * This is what the global discovery and era detection prompts work over —
 * significantly smaller than the raw messages.
 */

/**
 * @param {Array} chunkInsights   — validated ChunkInsight[] from chunk extraction
 * @param {Array} chunks          — AnalysisChunk[] for date ranges
 * @returns {Object} ChatMemory
 */
export function buildChatMemory(chunkInsights, chunks) {
  // Build periods from chunks + their insights
  const periods = chunks.map((chunk, i) => {
    const insight = chunkInsights.find(ci => ci.chunkId === chunk.id);
    return {
      dateRange: `${formatDate(chunk.startAt)} → ${formatDate(chunk.endAt)}`,
      topics: insight?.topics || [],
      events: (insight?.events || []).map(e => ({
        title: e.title,
        messageIds: e.messageIds || [],
      })),
      toneSignals: insight?.toneSignals || [],
      messageCount: chunk.messages.length,
    };
  });

  // Aggregate global topics (deduplicated, sorted by frequency)
  const topicFreq = {};
  for (const ci of chunkInsights) {
    for (const topic of ci.topics || []) {
      topicFreq[topic] = (topicFreq[topic] || 0) + 1;
    }
  }
  const globalTopics = Object.entries(topicFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 20);

  // Aggregate recurring phrases
  const phraseFreq = {};
  for (const ci of chunkInsights) {
    for (const phrase of ci.recurringPhrases || []) {
      phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
    }
  }
  const recurringPhrases = Object.entries(phraseFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p)
    .slice(0, 15);

  // All unique event titles
  const allEventTitles = [
    ...new Set(
      chunkInsights
        .flatMap(ci => ci.events || [])
        .sort((a, b) => (b.importance || 0) - (a.importance || 0))
        .slice(0, 30)
        .map(e => e.title)
    ),
  ];

  return {
    periods,
    globalTopics,
    recurringPhrases,
    allEventTitles,
  };
}

function formatDate(dateStr) {
  if (!dateStr) return 'unknown';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return dateStr;
  }
}
