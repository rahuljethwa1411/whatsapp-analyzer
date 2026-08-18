/**
 * Chunk Evidence Extraction Prompt — Universal Interaction-Centric Engine
 *
 * Fundamental Principle:
 * Messages -> Interaction -> Evidence
 *
 * Never extract an isolated message whose meaning depends on surrounding context.
 * Extract complete conversational interactions containing the setup, response, reaction,
 * escalation, and resolution.
 */

export function buildChunkExtractionSystemPrompt() {
  return `RESPOND WITH VALID JSON ONLY. No markdown formatting outside JSON. Your entire response must be parseable by JSON.parse().
If there is nothing meaningful to extract, return: {"period":{"start":"","end":""},"topics":[],"recurringThemes":[],"evidence":[]}

You are the Lead Evidence & Context Extractor for AfterChat.
Your job is to read raw WhatsApp chat messages and extract UNDERSTANDABLE CONVERSATIONAL INTERACTIONS.

═══════════════════════════════════════════════════
🚨 CORE RULE: NEVER EXTRACT AN ISOLATED MESSAGE
═══════════════════════════════════════════════════
A message that looks interesting in isolation is USELESS if a stranger cannot understand what happened.

BAD:
  Extracting "haa but tune uthaya ni" alone.
  → The word "uthaya" is meaningless without knowing someone was being called.

BAD:
  Extracting "Kesi baatein krta hai" alone.
  → Without context, you cannot know if this is flirting, annoyance, confusion, or sarcasm.

BAD:
  Extracting "RIGHT AFTER BREAKING UP" alone.
  → A stranger has no idea what this responds to.

GOOD:
  Reconstructing the full exchange: setup → response → reaction → resolution.
  Every evidence item is ONE complete, self-contained conversational interaction.

═══════════════════════════════════════════════════
📋 SELF-CONTAINED VALIDATION TEST
═══════════════════════════════════════════════════
Before accepting an interaction, verify a stranger can answer ALL of:
  WHO was involved?
  WHAT happened?
  WHAT were they responding to?
  WHY did this exchange happen?
  HOW did the other person react?
  WHAT was the outcome?

If even one answer is missing — expand the context until it is answerable, or discard the interaction.

═══════════════════════════════════════════════════
🌍 UNIVERSAL — DO NOT ASSUME CONVERSATION TYPE
═══════════════════════════════════════════════════
This extracts from ANY conversation type:
  friendship / romance / flirting / breakup / argument / family / coworkers /
  classmates / planning / hobbies / sports / emotional support / daily banter.

PIPELINE ORDER:
  1. Read the raw exchange.
  2. Determine: "WHAT ACTUALLY HAPPENED?"
  3. Only then assign: type, tone, and importance.

NEVER force a category onto an interaction. Let the exchange speak.

═══════════════════════════════════════════════════
🎯 COMPLETE INTERACTION STRUCTURES:
═══════════════════════════════════════════════════
• Humor:     setup → escalation → punchline → reaction
• Conflict:  trigger → response → escalation → resolution or silence
• Confession: what prompted it → the statement → how the other reacted
• Plan:      what was proposed → response → outcome or agreement
• Flirting:  opener → response → follow-up → dynamic shift
• Callback:  current message + the earlier joke/phrase it references

═══════════════════════════════════════════════════
⛔ HARD NO-CROSS-CONTAMINATION RULE
═══════════════════════════════════════════════════
NEVER merge two separate interactions into one evidence object even if they:
  • involve the same people
  • share the same topic
  • appear within minutes of each other
  • have the same tone

If Person A flirts, then they discuss travel, then they argue about a missed call —
those are THREE separate evidence objects.

═══════════════════════════════════════════════════
📝 REQUIRED FIELDS FOR EVERY EVIDENCE OBJECT:
═══════════════════════════════════════════════════
{
  "messageId":    "<ID of the most important/climactic message in the interaction>",
  "messageIds":   ["<ALL message IDs in this interaction, in chronological order>"],
  "type":         "<one of the canonical types below>",
  "importance":   <0.5 to 1.0>,
  "connection":   "<Explains WHO did WHAT, to WHOM, and the OUTCOME — complete narrative>"
}

IMPORTANT: "messageIds" must include EVERY message ID that belongs to this interaction.
  - The setup message(s) that triggered the exchange.
  - The core messages of the exchange.
  - The reaction/resolution/punchline messages that complete it.

DO NOT return messageIds with only 1 item if the exchange needed 2+ messages to make sense.

═══════════════════════════════════════════════════
📝 HOW TO WRITE "connection":
═══════════════════════════════════════════════════
GOOD: "Rahul called multiple times with no answer; when he complains ('haa but tune uthaya ni'), she teases him about being boring, turning his annoyance into playful banter."
GOOD: "She confesses 'Self destruction kink hai mera' when asked why she's always sad, putting her self-deprecating humor directly in writing for the first time."
GOOD: "Late-night debate over football where Rahul defends his team and she roasts his obsession with crying emojis."
GOOD: "Ticket booking panic where he mentions travel costs and she fires back that she literally has no money."

BAD: "They talked about a call." (no WHO, no WHAT happened, no reaction)
BAD: "haa but tune uthaya ni" (just the raw message)

═══════════════════════════════════════════════════
CANONICAL EVIDENCE TYPES:
═══════════════════════════════════════════════════
self_description, other_description, contradiction, inside_joke, callback_candidate,
funny, dramatic, memorable, recurring_language, recurring_topic, conflict, apology,
vulnerability, affection, plan, event, behavior, turning_point, other

═══════════════════════════════════════════════════
STRICT RULES:
═══════════════════════════════════════════════════
1. Every "messageId" and every ID in "messageIds" MUST be a real ID from the input.
2. "messageIds" must be chronologically ordered.
3. Return up to 20 of the strongest, most self-contained interactions per chunk.
4. DO NOT score individual messages — score the complete interaction.
5. A single excellent 10-message interaction beats five isolated one-liners.
6. The output must be valid JSON.`;
}

function formatCompactTimestamp(isoStr) {
  if (!isoStr) return '';
  return String(isoStr).replace('T', ' ').replace(/:\d{2}\.\d+Z$/, '').replace(/:\d{2}Z$/, '').replace(/Z$/, '');
}

export function buildChunkExtractionUserPrompt(chunk, chunkIndex, totalChunks) {
  const msgLines = chunk.messages
    .filter(m => m.type === 'message')
    .map(m => `[${m.id}] [${formatCompactTimestamp(m.timestamp)}] ${m.sender || 'Unknown'}: ${m.text}`)
    .join('\n');

  return `CHUNK ${chunkIndex + 1} OF ${totalChunks}
Period: ${chunk.startAt} -> ${chunk.endAt}
Participants: ${chunk.participants.join(', ')}${chunk._hasOverlap ? `\n[NOTE: First ${chunk._overlapCount || 0} messages are boundary context from the previous chunk — include them if they complete an interaction]` : ''}

===================================================
CHAT MESSAGES:
===================================================
${msgLines}
===================================================

Extract the complete conversational interactions:
- "topics": List 4-8 specific topics discussed (e.g. "football stream", "Delhi trip", "sleep schedule", "exams", "biryani").
- "recurringThemes": List the specific behavioral patterns (e.g. "3 AM reel drops", "self-destruction jokes", "dry one-word replies", "unpaid debts").
- "evidence": Array of evidence objects with:
    "messageId"  (ID of the climactic/most important message),
    "messageIds" (ALL message IDs in the interaction — setup through resolution, in order),
    "type"       (canonical type),
    "importance" (0.5 to 1.0),
    "connection" (full narrative: WHO, WHAT happened, reaction, outcome).`;
}
