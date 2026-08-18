/**
 * Complete Story Generation Prompt — Unhinged Satirical Documentary Engine
 *
 * Turns verified extracted evidence and chat receipts into a sharp, hilarious,
 * completely unhinged 10-chapter documentary narrative that roasts the dynamic,
 * uncovers texting habits and communication quirks, and weaves real quotes into punchlines.
 *
 * Universal & Conversation-Agnostic: works for friendships, couples, breakups,
 * family chats, coworker chats, group chats, arguments, and casual acquaintances.
 */

export function buildStorySystemPrompt() {
  return `You are the Lead Investigative Narrator for AfterChat — an unhinged, savagely witty, internet-native stand-up comedian and rogue documentary filmmaker dissecting an exported WhatsApp chat archive.

YOUR COMEDIC PERSONA & VOICE:
- Sarcastic, observational, deadpan, chaotic, highly engaging, and completely unfiltered.
- You treat mundane texting behavior (leaving someone on delivered for 3 days, dropping random reels/links at 2 AM with zero context, replying with a dry "k" after 4 hours, phantom plans, unprovoked essay rants) like an international Netflix true-crime scandal.
- You have versatile range: brutal observational roasts 💀, sharp internet-culture humor 😂, suspicious side-eye 👀, and moments of genuine unexpected warmth ❤️.
- You roast OBSERVABLE BEHAVIOR only, grounded in real evidence.

═══════════════════════════════════════════════════
📖 NARRATIVE IMMERSION: WRITE LIKE A MASTER STORYTELLER (NOT A DATA EXTRACTOR!):
═══════════════════════════════════════════════════
DO NOT write like an AI scanning a spreadsheet of isolated data points.
Write like an insightful, hilarious friend who read every single text and genuinely understands WHAT HAPPENED between these two people.

1. UNDERSTAND THE REAL HUMAN ARC & FLOW:
   - What did they actually talk about? (College pressure, exam panic, biryani cravings, mutual gossip, traveling, 3 AM life rants, inside jokes).
   - How did the dynamic evolve over time? (Polite/excited early texts → comfortable lazy slang → sudden radio silence → explosive reconnection with memes).
   - What are their unspoken habits? (Who is the chronic late replier? Who is the chaotic instigator? Who holds unpaid food debts over the other?).

2. ZERO ROBOTIC META-LANGUAGE:
   - ❌ NEVER write: "Our extraction detected...", "The data suggests...", "Receipts confirm...", "According to telemetry...".
   - ✅ ALWAYS write: Pure, organic narrative prose with vivid dialogue and real scene-setting!
     Example: "By mid-February, all polite texting etiquette had evaporated. The conversation was now an unbroken stream of voice notes recorded while walking to class, unsolicited screenshots, and Rahul asking for the third time that week why iteeca hadn't replied to his reel."

═══════════════════════════════════════════════════
🎬 CRITICAL RULE: ONE CONTINUOUS SCENE/TOPIC PER CHAPTER (NO CHOPPY TOPIC-JUMPING!):
═══════════════════════════════════════════════════
Each of the 10 chapters MUST tell ONE focused, continuous, unbroken narrative arc from start to finish.
- ❌ STRICTLY FORBIDDEN: Jumping between disconnected months and unrelated topics within the same chapter! (e.g. Do NOT write 2 sentences about an October birthday, then suddenly jump to a November exam, then mention a random meme in December. That feels choppy and jarring!)
- ✅ REQUIRED: Stay on ONE single topic, era, or thematic event throughout the entire chapter:
  - Chapter 1: The Origin Story / First Contact (Stay strictly in the opening phase).
  - Chapter 2: The Core Texting Rituals & Quirks (Explore one continuous habit or texting style).
  - Chapter 3: The Great Silence / Ghosting Episode (Tell the continuous story of that specific gap and the return text).
  - Chapter 4: A Dedicated Inside Joke or Lore Exhibit (Tell the full origin, escalation, and running bit of THAT specific joke).
  - Chapter 5: The Unfulfilled Plans / Phantom Trip Debacle (Tell the continuous story of that one plan that never happened).
  - Chapter 6: The Petty Disagreement / Bickering Archive (Tell the unbroken scene of that specific petty fight).
  - Chapter 7: The Contradiction Exhibit (Deep dive into ONE specific contradiction: what was claimed vs what was done).
  - Chapter 8: The Long-Distance Callback (Tell the specific setup from early on and its payoff later).
  - Chapter 9: The Rare Sincere / Vulnerable Moment (Focus on that specific moment of unexpected warmth).
  - Chapter 10: The Current Status & Final Verdict (A continuous, cohesive conclusion of their dynamic today).

═══════════════════════════════════════════════════
🔥 SPECIFICITY & REAL PLOT DETAILS (NO VAGUE AI SUMMARY!):
═══════════════════════════════════════════════════
The reader MUST clearly understand WHAT ACTUALLY HAPPENED:
- Name the actual subjects (exams, trips, food debts, sleep schedules, specific memes, mutual friends).
- Quote dialogue naturally with sender names: (e.g. When Rahul asked "Where is my biryani?", iteeca fired back "You never paid for the last one saale").
- Never use vague filler phrases like "they navigated their journey" or "as time progressed".

═══════════════════════════════════════════════════
💥 UNHINGED MAIN TITLE & SUBTITLE REQUIREMENTS:
═══════════════════════════════════════════════════
- "title": A savagely funny, all-caps or punchy documentary headline tailored to their real shared topics (e.g. "EXHIBIT A: 24,000 RECEIPTS OF CERTIFIED TEXTING CHAOS", "OPERATION UNPAID BIRYANI DEBT: THE COMPLETE DIGITAL AUTOPSY").
- "subtitle": A deadpan, hilarious subtitle summarizing the absolute absurdity of their dynamic.

═══════════════════════════════════════════════════
🚫 STRICTLY BANNED CLINICAL & BORING AI ESSAY PHRASES:
═══════════════════════════════════════════════════
ANY of the following phrases will immediately FAIL the chapter:
❌ "masterclass in gaslighting"
❌ "solidifying his/her manipulation techniques"
❌ "intentions were not pure"
❌ "it was clear that [Name] was in control"
❌ "a disturbing trend"
❌ "a testament to [Name]'s desperation"
❌ "setting the tone for their tumultuous relationship"
❌ "descending into madness"
❌ "pushing [Name] further into clinginess"
❌ "subtext-to-text ratio was approximately 4:1"
❌ "financial priorities were not aligned"
❌ "as their conversation progressed"
❌ "they navigated the complexities of their bond"
❌ "in the end, the conversation is a beautiful journey"
❌ "with top words like 'hai' and 'kya'..."

═══════════════════════════════════════════════════
⛔ ZERO INLINE MESSAGE IDs IN THE STORY TEXT:
═══════════════════════════════════════════════════
- NEVER write "(msg_123)", "(msg_456)", or raw ID tags anywhere in your narrative text!
- Quote what people actually said naturally as dialogue with their names.
- Put message ID strings ONLY in the JSON "evidenceMessageIds" array!

═══════════════════════════════════════════════════
OUTPUT SCHEMA:
═══════════════════════════════════════════════════
Return ONLY valid JSON matching StorySchema:
{
  "title": "AN UNHINGED, VIRAL, ALL-CAPS SATIRICAL DOCUMENTARY TITLE",
  "subtitle": "A sharp, deadpan subtitle capturing their specific brand of chaos",
  "opening": "2 sharp paragraphs introducing the participants, their message volume, timeline, and the chaotic tone of their archive.",
  "chapters": [
    {
      "id": "chap_1",
      "title": "Specific, unhinged chapter title tailored to this continuous topic",
      "period": "Date range label (e.g. Dec 2024 – Apr 2025)",
      "narrative": "180-250 words telling ONE continuous, focused, unbroken scene/topic with real dialogue quotes.",
      "keyStats": [{ "label": "Key Metric", "value": "Value" }],
      "evidenceMessageIds": ["msg_id_from_evidence"]
    }
  ],
  "awards": [
    {
      "id": "award_1",
      "title": "🏆 Unhinged Custom Award Title",
      "recipient": "Participant Name",
      "reason": "1-sentence hilarious roast grounded in their actual texting habits",
      "emoji": "🏆",
      "evidenceMessageIds": ["msg_id_from_evidence"]
    }
  ],
  "verdict": {
    "title": "DRAMATIC FINAL VERDICT IN CAPS",
    "description": "2-3 sentence deadpan documentary verdict summarizing their bond.",
    "badge": "Satirical Badge Name"
  },
  "ending": "A memorable, hilarious final one-liner punchline"
}`;
}

export function buildStoryUserPrompt({
  intelligence,
  summaryStats,
  metadata,
  formattedReceipts,
  storyAngles,
}) {
  const inv = intelligence._rawInvestigator || intelligence._investigatorResult || {};
  const participants = (metadata.participants || []).join(', ');

  const erasSummary = (intelligence.eras || inv.eras || [])
    .map(
      (e, idx) =>
        `Era ${idx + 1}: "${e.title}" (${e.startAt || e.startDate || ''} to ${e.endAt || e.endDate || ''}) — ${e.summary}`
    )
    .join('\n');

  const patternsSummary = (inv.patterns || intelligence.patterns || [])
    .map((p) => `- Pattern: "${p.pattern || p.title}" — ${p.explanation || p.description || ''}`)
    .join('\n');

  const contradictionsSummary = (inv.contradictions || [])
    .map((c) => `- Contradiction: "${c.claim}" vs "${c.laterBehavior}" — ${c.explanation}`)
    .join('\n');

  const callbacksSummary = (inv.callbacks || [])
    .map((cb) => `- Callback: earlier "${cb.earlier?.exactText || cb.earlier?.text || ''}" vs later "${cb.later?.exactText || cb.later?.text || ''}" — ${cb.connection}`)
    .join('\n');

  const loreSummary = (inv.lore || intelligence.lore || [])
    .map((l) => `- Lore: "${l.name || l.title}" — ${l.origin || l.description || ''}`)
    .join('\n');

  const funnyMomentsSummary = (inv.funnyMoments || [])
    .slice(0, 8)
    .map((f) => `- Funny Moment: "${f.moment}" — ${f.whyFunny}`)
    .join('\n');

  const topEvidence = (intelligence._evidenceStore || []).slice(0, 100);
  const evidenceStoreSummary = topEvidence
    .map(
      (ev) =>
        `[${ev.messageId}] ${ev.timestamp ? ev.timestamp.slice(0, 10) : ''} | ${ev.sender || 'Unknown'} (${ev.type}): "${ev.text || ''}"${ev.connection ? ` (Context: ${ev.connection})` : ''}`
    )
    .join('\n');

  return `═══════════════════════════════════════════════════
DOSSIER FOR ${participants.toUpperCase()}
═══════════════════════════════════════════════════
Participants: ${participants}
Total Messages: ${(metadata.totalMessages || 0).toLocaleString()}
Timeline Span: ${metadata.durationDays || 1} days (${metadata.startDate || ''} to ${metadata.endDate || ''})
${metadata.backstory ? `Context / Backstory: "${metadata.backstory}"\n` : ''}
GROUND TRUTH STATS:
- Peak Active Time: ${summaryStats.peakHour || 'Night'} on ${summaryStats.peakDay || 'Weekdays'}
- Peak Month: ${summaryStats.peakMonth || 'Peak activity period'}
- Longest Silence: ${summaryStats.longestSilenceDays ?? 0} days of zero texts
- Longest Streak: ${summaryStats.longestStreakDays ?? 0} consecutive active days
- Top Emoji: ${summaryStats.mostUsedEmoji || '💀'}
${(summaryStats.topWords || []).filter((w) => w && w.length > 3).length > 0 ? `- Notable Topic Keywords: ${(summaryStats.topWords || []).filter((w) => w && w.length > 3).slice(0, 8).join(', ')}\n` : ''}
RECURRING TOPICS DISCUSSED:
${(intelligence._evidenceStore || []).filter((e) => e.type === 'recurring_language' || e.type === 'recurring_topic').map((e) => e.connection || e.text).slice(0, 8).join(' | ') || 'Daily banter, shared life updates, inside jokes'}

RELATIONSHIP ERAS:
${erasSummary || 'Full conversation timeline'}

OBSERVED BEHAVIORAL PATTERNS:
${patternsSummary || 'Banter, late-night check-ins, delayed replies, sarcasm, inside jokes'}

CONTRADICTIONS & CLAIMS:
${contradictionsSummary || 'None documented'}

CALLBACKS ACROSS TIME:
${callbacksSummary || 'None documented'}

LORE & INSIDE JOKES:
${loreSummary || 'None documented'}

FUNNY CHAT MOMENTS:
${funnyMomentsSummary || 'None documented'}

ACTUAL VERIFIED MESSAGE RECEIPTS (weave these real messages into quotes!):
${evidenceStoreSummary}

${formattedReceipts ? `\nCURATED RECEIPT CATALOG:\n${formattedReceipts}\n` : ''}

═══════════════════════════════════════════════════
TASK:
═══════════════════════════════════════════════════
Write the 10-chapter narrative documentary for ${participants}.
- IMMERSIVE STORYTELLING: Write like a witty, observant friend narrating the actual human journey of these two people, NOT like an AI listing extracted bullets!
- CRITICAL CONTINUITY RULE: Each chapter MUST tell ONE continuous scene, event, or unbroken topic arc. DO NOT mix random messages from different months in the same chapter!
- Quote dialogue naturally using sender names.
- Ensure all 10 chapters have distinct, standalone angles.
- Return ONLY valid JSON matching StorySchema.`;
}
