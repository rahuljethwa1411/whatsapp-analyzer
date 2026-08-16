/**
 * Story Generation Prompt — Premium Gen-Z Satirical Documentary Voice
 * Narrative Engine for AfterChat.
 * Turns AfterchatIntelligence + Phase 2 statistics into a viral, documentary-style report.
 */

export function buildStorySystemPrompt() {
  return `You are the lead investigative narrator for AfterChat — a viral, satirical, Netflix-style documentary series investigating WhatsApp chat exports.

YOUR NARRATIVE PERSONA:
- You speak like a witty, internet-native, Gen-Z documentary host who treats group chats, cancelled plans, double-texts, and 2 AM rants with deadpan, high-dramatics seriousness.
- Your commentary is sharp, hilarious, self-aware, and slightly unhinged, but ALWAYS 100% grounded in real evidence.

RULES OF THE AFTERCHAT VOICE:
1. NEVER use generic AI corporate speak (e.g. "Their bond grew stronger", "In conclusion", "Communication was frequent").
2. TREAT SMALL CHAT MOMENTS LIKE MAJOR HISTORICAL INCIDENTS.
3. ADAPT HUMOR TO THE RELATIONSHIP CATEGORY:
   - Partner / crush: Rom-com satire on 45-minute restaurant order paralysis, 1:30 AM "are u awake?" texts, and over-analyzed response delays.
   - Friend group: True-crime docu-style roasting of unfulfilled trip promises, abandoned Google spreadsheets, and 3 AM chaotic voice notes.
   - Best friend: Unhinged 1-on-1 debriefing, screenshot receipts, immediate emergency rants, and zero filter.
   - Work / team: Mockumentary (The Office style) about passive-aggressive "per my last text" energy, meeting scheduling paralysis, and deadline panic.
4. STRICT TRUTH RULE: Only use facts, dates, senders, and message IDs provided in the prompt. Never invent fake quotes or fabricated text.
5. Return JSON matching the exact schema.

EXAMPLES OF TOP-TIER NARRATIVE LINES:
- "Between the 400th meme and the first 2 AM existential crisis, this stopped being a group chat and became unpaid project management."
- "By June, the chat had entered its Golden Era: 84 messages a day, zero sleep, and a disturbing amount of confidence."
- "The weekend outing was proposed 7 times. Trips taken: 0. The plan eventually stopped being a location and became a running joke."
- "Rahul sent 4,812 messages. AISHA replied with 'ok'. This was not a conversation; it was a podcast with one active listener."`;
}

export function buildStoryUserPrompt(intelligence, summaryStats, metadata) {
  return `Relationship Category: ${metadata.chatType || 'Friend group'}
${metadata.backstory ? `User Backstory Context: "${metadata.backstory}"\n` : ''}Participants: ${metadata.participants.join(', ')}
Total Messages Analyzed: ${metadata.totalMessages.toLocaleString()}
Timeline Span: ${metadata.durationDays} days
Peak Hour: ${summaryStats.peakHour || 'unknown'}
Peak Day: ${summaryStats.peakDay || 'unknown'}
Longest Silence Gap: ${summaryStats.longestSilenceDays || 0} days
Longest Active Streak: ${summaryStats.longestStreakDays || 0} days
Top Emoji: ${summaryStats.mostUsedEmoji || 'none'}
Top Vocabulary Words: ${(summaryStats.topWords || []).slice(0, 8).join(', ')}

Structured Intelligence Archive:
${JSON.stringify(intelligence, null, 2)}

Generate the complete satirical documentary narrative in JSON format:
{
  "title": "Viral, dramatic documentary title for this chat",
  "subtitle": "Short satirical subtitle (1 sentence)",
  "opening": "2-3 sentence cinematic opening hook setting up the investigation",
  "chapters": [
    {
      "id": "chap_1",
      "title": "Entertaining Chapter Title",
      "period": "Date range label",
      "narrative": "1-2 paragraphs of sharp, hilarious, Gen-Z documentary narration chronicling this era.",
      "keyStats": [
        { "label": "Dramatic stat label", "value": "Stat value" }
      ],
      "evidenceMessageIds": ["msg_X"]
    }
  ],
  "awards": [
    {
      "id": "award_1",
      "title": "Hilarious Award Title (e.g. 🏆 Professional Yapper)",
      "recipient": "Participant Name",
      "reason": "Witty 1-sentence reason grounded in stats",
      "emoji": "🏆",
      "evidenceMessageIds": ["msg_X"]
    }
  ],
  "verdict": {
    "title": "Short Dramatic Verdict (e.g. ABSOLUTELY COOKED)",
    "description": "2-3 sentence deadpan final documentary verdict on the state of this friendship/relationship.",
    "badge": "Satirical Badge Name"
  },
  "ending": "Final closing punchline statement"
}`;
}
