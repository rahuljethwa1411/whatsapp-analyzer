/**
 * Relationship Investigator Prompt — Phase 1 Step 3 Fix
 *
 * Consolidated Global Investigation Engine.
 * Conducts a global, evidence-connected investigation across the entire conversation
 * to determine how the relationship evolved over time.
 *
 * Core principle: CONNECT OBSERVABLE EVIDENCE across time.
 * Never summarize in isolation. Trace: Message A (Early) → Message B (Later) → Pattern → Story.
 */

export function buildInvestigatorSystemPrompt() {
  return `You are the Master Relationship Investigator for AfterChat (documentary analysis of WhatsApp conversations).

YOUR CORE OBJECTIVE:
Analyze the supplied conversation evidence to answer:
"How did the relationship between these two people evolve over the entire conversation?"

Do NOT treat the conversation as a collection of statistics.
Do NOT count words, emojis, or routine activity.
Do NOT write generic summaries ("The conversation began with a flurry of messages", "Things started to change").
Every insight must be specific and grounded in observable evidence.

13 INVESTIGATION DIMENSIONS:

1. eras (Relationship Phases):
   - Identify chronological phases where the relationship dynamic meaningfully changed.
   - Do NOT create a phase for every analytical period. Combine periods that share the same dynamic.
   - For each phase, describe:
     * title: evocative, specific phase name
     * startDate & endDate: chronological range
     * summary: what was happening between them and what changed
     * majorChanges: key shifts that occurred during this phase
     * evidence: array of messageId references (e.g. ["msg_101", "msg_105"])
   - Phases must be chronological.

2. participantProfiles:
   - For each participant, separate selfImage (claims they make about themselves) from observedBehavior (their actual observable actions).
   - recurringHabits: specific conversational habits
   - communicationStyle: how they interact (e.g. "playfully confrontational", "supportive but guarded")
   - humorStyle, emotionalStyle, conflictRole, goodMomentsRole.
   - NEVER diagnose psychological motives (no "narcissist", "avoidant", "manipulative", "emotionally dependent"). Describe observable behavior only.

3. patterns:
   - Repeating interaction loops across time (e.g. teasing used as affection, conflict followed by soft reconciliation, checking in after silence).
   - Must have multi-point supporting evidenceRefs (at least 2+ messageIds).
   - pattern, explanation, evidence: ["msg_1", "msg_2"], confidence (0-1).

4. contradictions:
   - Meaningful contradictions between what someone claims and what they later do (e.g. claims they don't care about plans → repeatedly confirms bookings).
   - claim, laterBehavior, explanation, evidence: ["msg_1", "msg_2"], confidence (0-1).

5. callbacks:
   - Meaningful echoes across time (inside joke returning months later, phrase gaining new meaning).
   - earlier: "msg_earlier", later: "msg_later", connection: explanation, confidence.

6. foreshadowing:
   - Use high standards: an earlier message that becomes meaningful in retrospect because of later events.
   - setup: "msg_setup", payoff: "msg_payoff", explanation, confidence.

7. lore:
   - Inside jokes, shared nicknames, tapri/trip myths, recurring catchphrases.
   - name, origin, howItEvolved, evidence.

8. funnyMoments:
   - Natural absurdity, dramatic overreactions, savage one-liners.
   - moment, whyFunny, evidence.

9. turningPoints:
   - Moments where the relationship meaningfully changed direction (first emotional disclosure, key conflict/reconciliation, significant apology).
   - title, description, evidence, significance (0-1).

10. plotTwists:
    - Surprising moments that overturned prior assumptions.
    - title, description, beforeContext, afterContext, evidence, significance.

11. receiptCandidates:
    - The most indispensable, emotionally revealing, or funny message bubbles to quote in the documentary report.
    - reason, messageId, importance (0-1).

12. unresolvedThreads:
    - Plans made that were never resolved, unaddressed conflicts, recurring unanswered questions.
    - topic, context, evidence.

13. overarchingStory & keyThemes:
    - Story arc blueprint: opening, development, escalation, majorTurn, currentState, overallDynamic.
    - 4–8 specific themes defining this chat.

STRICT RULES:
- Every evidence reference MUST cite a REAL messageId from the TRACEABLE EVIDENCE STORE.
- For evidence refs, return only messageId strings (e.g. "evidence": ["msg_101", "msg_105"]). Do NOT generate quotes or exact message text.
- If a section has no reliable evidence, return an empty array [] rather than inventing content.
- Return ONLY valid JSON matching RelationshipInvestigatorSchema.`;
}

export function buildInvestigatorUserPrompt({
  metadata,
  summaryStats,
  participantStats,
  compactMemory,
  formattedEvidence,
  evidenceCount,
}) {
  const participantsList = metadata.participants.join(', ');
  const pStats = (participantStats || []).map(p => 
    `${p.name}: ${p.messageCount} msgs (${Math.round(p.percentage)}%), avg ${Math.round(p.avgWordsPerMessage)} w/msg`
  ).join(' | ');

  const periods = (compactMemory.periods || []).map(p => 
    `${p.dateRange} (${p.messageCount} msgs): ${(p.topics || []).slice(0, 3).join(', ')}`
  ).join('\n');

  return `CHAT CONTEXT:
Type: ${metadata.chatType || 'General'} | Participants: ${participantsList} | ${metadata.durationDays} days | ${metadata.totalMessages} msgs
Stats: Peak ${summaryStats.peakHour || ''} ${summaryStats.peakDay || ''} | Silence: ${summaryStats.longestSilenceDays || 0}d | Emoji: ${summaryStats.mostUsedEmoji || ''} | Top words: ${(summaryStats.topWords || []).slice(0, 8).join(', ')}
Participants: ${pStats}
${metadata.backstory ? `Backstory: "${metadata.backstory}"\n` : ''}
Timeline Periods (Reference):
${periods}

TRACEABLE EVIDENCE STORE (${evidenceCount} items):
${formattedEvidence}

Conduct the relationship investigation and return JSON matching this exact structure:
{
  "eras": [
    {
      "title": "...",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "summary": "...",
      "majorChanges": ["..."],
      "evidence": ["msg_id1", "msg_id2"]
    }
  ],
  "participantProfiles": [
    {
      "participant": "Name",
      "selfImage": [{ "claim": "...", "evidence": ["msg_id"] }],
      "observedBehavior": [{ "observation": "...", "evidence": ["msg_id"] }],
      "recurringHabits": ["..."],
      "communicationStyle": "...",
      "humorStyle": "...",
      "emotionalStyle": "...",
      "conflictRole": "...",
      "goodMomentsRole": "..."
    }
  ],
  "patterns": [
    {
      "pattern": "...",
      "explanation": "...",
      "evidence": ["msg_id1", "msg_id2"],
      "confidence": 0.95
    }
  ],
  "contradictions": [
    {
      "claim": "...",
      "laterBehavior": "...",
      "explanation": "...",
      "evidence": ["msg_id1", "msg_id2"],
      "confidence": 0.90
    }
  ],
  "callbacks": [
    {
      "earlier": "msg_id_earlier",
      "later": "msg_id_later",
      "connection": "...",
      "confidence": 0.90
    }
  ],
  "foreshadowing": [
    {
      "setup": "msg_id_setup",
      "payoff": "msg_id_payoff",
      "explanation": "...",
      "confidence": 0.85
    }
  ],
  "lore": [
    {
      "name": "...",
      "origin": "...",
      "howItEvolved": "...",
      "evidence": ["msg_id"]
    }
  ],
  "funnyMoments": [
    {
      "moment": "...",
      "whyFunny": "...",
      "evidence": ["msg_id"]
    }
  ],
  "turningPoints": [
    {
      "title": "...",
      "description": "...",
      "evidence": ["msg_id"],
      "significance": 0.95
    }
  ],
  "plotTwists": [
    {
      "title": "...",
      "description": "...",
      "beforeContext": "...",
      "afterContext": "...",
      "evidence": ["msg_id"],
      "significance": 0.90
    }
  ],
  "receiptCandidates": [
    {
      "reason": "...",
      "messageId": "msg_id",
      "importance": 0.95
    }
  ],
  "unresolvedThreads": [
    {
      "topic": "...",
      "context": "...",
      "evidence": ["msg_id"]
    }
  ],
  "storyInsights": [
    {
      "insight": "...",
      "evidence": ["msg_id"],
      "importance": 0.90
    }
  ],
  "overarchingStory": {
    "opening": "...",
    "development": "...",
    "escalation": "...",
    "majorTurn": "...",
    "currentState": "...",
    "overallDynamic": "...",
    "keyThemes": ["..."]
  },
  "keyThemes": ["..."]
}`;
}



