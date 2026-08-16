/**
 * Era Detection Prompt — Gen-Z Documentary Timeline Editor
 * Used for: identifying meaningful conversation eras with entertaining, dramatic titles.
 */

export function buildEraDetectionSystemPrompt() {
  return `You are the chief timeline editor for AfterChat — a viral documentary series investigating WhatsApp chat exports.

Your task: partition the chat history into distinct, highly dramatic, hilarious narrative "eras" or "chapters".

TIMELINE EDITOR MINDSET:
- Group chats and private conversations go through distinct historical epochs.
- An "era" is defined by a shift in energy, topic obsession, participant drama, peak activity, or collective delusion (e.g. planning a trip that never happened).
- Titles must sound like titles of docuseries episodes on Netflix or HBO.

RULES:
1. Do NOT split eras by calendar month unless there is a genuine behavioral or topic shift.
2. Use activity shifts, topic changes, tone changes, or event boundaries to mark era transitions.
3. Era titles should be specific, witty, and dramatic — never generic calendar dates.
4. Summaries should be factual and concise (1-2 sentences) so Phase 4 narrative generation can build hilarious prose upon them.
5. Every era must have at least one evidenceMessageId if messages are present.
6. Only use message IDs from the provided memory.
7. Return JSON only.

GREAT ERA TITLE EXAMPLES:
- "The Era of Late-Night Debriefs (May - Jun)"
- "The Great 2 AM Philosophy Renaissance"
- "The Ghosting & Radio Silence Incident"
- "The Unprecedented Meme Dump Period"
- "The Job Application Panic Arc"
- "The Post-Exam Delirium Phase"

BAD ERA TITLE EXAMPLES:
- "Phase 1: March 2024"
- "Initial Interaction"
- "Period of High Volume Messaging"`;
}

export function buildEraDetectionUserPrompt(compactMemory, metadata) {
  // Collect all evidence IDs from the memory for the model to reference
  const allEvidenceIds = [
    ...(compactMemory.globalEvents || []).flatMap(e => e.messageIds || []),
    ...(compactMemory.globalMoments || []).flatMap(m => m.messageIds || []),
  ].slice(0, 50);

  return `Chat overview:
Participants: ${metadata.participants.join(', ')}
Category: ${metadata.chatType || 'Friend group'}
${metadata.backstory ? `User Context/Backstory: "${metadata.backstory}"\n` : ''}Duration: ${metadata.durationDays} days
Total messages: ${compactMemory.totalMessages || metadata.totalMessages}
Timeline: ${compactMemory.timelineStart} → ${compactMemory.timelineEnd}

Global Topics: ${(compactMemory.globalTopics || []).join(', ')}
Recurring Themes: ${(compactMemory.recurringThemes || []).join(', ')}

Timeline periods (compact):
${JSON.stringify(
    (compactMemory.periods || []).map(p => ({
      dateRange: p.dateRange,
      messageCount: p.messageCount,
      topics: p.topics.slice(0, 5),
      themes: p.recurringThemes,
    })),
    null,
    2
  )}

Available evidence message IDs (only use these):
${allEvidenceIds.join(', ')}

Identify 2-6 meaningful, dramatic eras. Return JSON:
{
  "eras": [
    {
      "id": "era_1",
      "title": "Dramatic, hilarious era title",
      "startAt": "approximate date string",
      "endAt": "approximate date string",
      "summary": "1-2 sentence factual summary of what defined this era",
      "dominantTopics": ["topic1", "topic2"],
      "tone": "playful|chaotic|emotional|quiet|intense|wholesome",
      "importance": 0.0-1.0,
      "evidenceMessageIds": ["msg_X"]
    }
  ]
}`;
}
