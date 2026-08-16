import { z } from 'zod';

// ─── Request ────────────────────────────────────────────────────────────────

export const AnalyzeRequestSchema = z.object({
  metadata: z.object({
    totalMessages: z.number(),
    totalParticipants: z.number(),
    participants: z.array(z.string()),
    durationDays: z.number(),
    mediaMessageCount: z.number(),
    systemMessageCount: z.number(),
    firstMessageAt: z.string().nullable(),
    lastMessageAt: z.string().nullable(),
    chatType: z.string().optional().nullable(),
    backstory: z.string().optional().nullable(),
  }),
  summaryStats: z.object({
    peakHour: z.string().nullable(),
    peakDay: z.string().nullable(),
    peakMonth: z.string().nullable(),
    longestSilenceDays: z.number().nullable(),
    longestStreakDays: z.number().nullable(),
    mostUsedEmoji: z.string().nullable(),
    topWords: z.array(z.string()),
  }),
  chunks: z.array(z.object({
    id: z.string(),
    startAt: z.string(),
    endAt: z.string(),
    sessionIds: z.array(z.string()),
    participants: z.array(z.string()),
    messages: z.array(z.object({
      id: z.string(),
      timestamp: z.string(),
      sender: z.string().nullable(),
      text: z.string(),
      type: z.enum(['message', 'system', 'media']),
    })),
  })),
});

// ─── Evidence Extraction (Phase 3 V2) ───────────────────────────────────────
//
// Replaces the old summary-based CompactChunkExtractionSchema.
// Designed for the SMALL extraction model — traceable evidence IDs, not prose.
//
// Core principle: PRESERVE EVIDENCE, not summaries.
// Every item must be traceable back to its original message via messageId.
// The exact original message text is resolved by the application from the dataset.

export const ALLOWED_EVIDENCE_TYPES = [
  'affection',
  'love',
  'flirting',
  'rejection',
  'conflict',
  'apology',
  'vulnerability',
  'promise',
  'contradiction',
  'behavior',
  'turning_point',
  'relationship_signal',
  'personality_signal',
  'event',
  'plan',
  'inside_joke',
  'callback_candidate',
  'foreshadowing_candidate',
  'funny',
  'dramatic',
  'memorable',
  'self_description',
  'other_description',
  'recurring_language',
  'other',
];

export const EvidenceItemSchema = z.object({
  // ── Traceability (required for receipts) ──────────────────────────────────
  messageId:  z.string(),   // exact ID from the input messages list

  // ── Classification ───────────────────────────────────────────────────────
  // Model-facing semantic category. Normalize to the canonical taxonomy after
  // parsing so an unknown category does not discard the whole chunk.
  type: z.string(),
  original_type: z.string().optional(),

  // ── Importance (0–1) ─────────────────────────────────────────────────────
  importance: z.number().min(0).max(1),

  // ── Significance / Context (Why this message matters) ─────────────────────
  connection: z.string().optional(),

  // ── Application-resolved properties (optional in LLM output) ─────────────
  text:       z.string().optional(),   // Populated by application from raw dataset
  sender:     z.string().optional(),   // Populated by application from raw dataset
  timestamp:  z.string().optional(),   // Populated by application from raw dataset

  // ── Optional enrichment ───────────────────────────────────────────────────
  tags:                 z.array(z.string()).max(5).optional(),
  potentialConnections: z.array(z.string()).max(3).optional(),
});

// ChunkEvidenceSchema — single-pass output from the extraction model.
// Keeps period/topics/recurringThemes for memory.js compatibility,
// and adds evidence[] for the new traceable evidence store.
export const ChunkEvidenceSchema = z.object({
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  // Kept for memory.js → CompactChatMemory building (unchanged downstream)
  topics:          z.array(z.string()).max(8),
  recurringThemes: z.array(z.string()).max(5),
  // Core new field — traceable evidence items
  evidence: z.array(EvidenceItemSchema).max(20),
});

// ── Backward-compat aliases ───────────────────────────────────────────────────
// CompactChunkExtractionSchema → alias of ChunkEvidenceSchema
// ChunkInsightSchema           → alias of ChunkEvidenceSchema
// Any code referencing either still compiles; memory.js is adapted to the new shape.
export const CompactChunkExtractionSchema = ChunkEvidenceSchema;
export const ChunkInsightSchema = ChunkEvidenceSchema;

// ─── Compact Chat Memory ──────────────────────────────────────────────────────
//
// The merged, deduplicated memory passed to ALL synthesis model calls.
// Significantly smaller than raw chat — typically 5k–15k tokens.

export const CompactChatMemorySchema = z.object({
  timelineStart: z.string(),
  timelineEnd: z.string(),
  totalMessages: z.number(),
  participants: z.array(z.object({
    name: z.string(),
    messageCount: z.number(),
    percentage: z.number(),
  })),
  periods: z.array(z.object({
    dateRange: z.string(),
    messageCount: z.number(),
    topics: z.array(z.string()),
    events: z.array(z.object({
      description: z.string(),
      messageIds: z.array(z.string()),
    })),
    notableMoments: z.array(z.object({
      description: z.string(),
      messageIds: z.array(z.string()),
    })),
    recurringThemes: z.array(z.string()),
  })),
  globalTopics: z.array(z.string()),
  globalEvents: z.array(z.object({
    description: z.string(),
    messageIds: z.array(z.string()),
  })),
  globalMoments: z.array(z.object({
    description: z.string(),
    messageIds: z.array(z.string()),
  })),
  globalPatterns: z.array(z.object({
    description: z.string(),
    messageIds: z.array(z.string()),
  })),
  recurringThemes: z.array(z.string()),
  // Extraction quality metadata
  _meta: z.object({
    chunksTotal: z.number(),
    chunksSucceeded: z.number(),
    chunksFailed: z.number(),
    extractionModel: z.string(),
  }).optional(),
});

// Keep old ChatMemorySchema exported for any Phase 4 references
export const ChatMemorySchema = CompactChatMemorySchema;

// ─── Relationship Investigator (Phase 3 V2) ──────────────────────────────────
//
// Single consolidated synthesis schema.
// Replaces 6 fragmented LLM calls with 1 global reasoning pass across all evidence.
// Produces a comprehensive story blueprint + evidence connection graph.

export const EvidenceRefSchema = z.union([
  z.string().transform(id => ({ messageId: id, timestamp: '', exactText: '' })),
  z.object({
    messageId: z.string(),
    timestamp: z.string().default(''),
    exactText: z.string().default(''),
  }),
]);

export const RelationshipInvestigatorSchema = z.object({
  // 1. Relationship timeline / eras
  eras: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    startDate: z.string().default(''),
    endDate: z.string().default(''),
    summary: z.string().default(''),
    dominantTopics: z.array(z.string()).optional(),
    tone: z.string().optional(),
    majorChanges: z.array(z.string()).default([]),
    evidence: z.array(EvidenceRefSchema).max(6).default([]),
  })).max(12).default([]),

  // 2. Behavioral character profiles
  participantProfiles: z.array(z.object({
    participant: z.string(),
    selfImage: z.array(z.object({
      claim: z.string(),
      evidence: z.array(EvidenceRefSchema).max(4).default([]),
    })).max(5).default([]),
    observedBehavior: z.array(z.object({
      observation: z.string(),
      evidence: z.array(EvidenceRefSchema).max(4).default([]),
    })).max(5).default([]),
    recurringHabits: z.array(z.string()).max(6).default([]),
    communicationStyle: z.string().default('Conversational'),
    humorStyle: z.string().optional(),
    emotionalStyle: z.string().optional(),
    conflictRole: z.string().optional(),
    goodMomentsRole: z.string().optional(),
  })).default([]),

  // 3. Behavioral patterns across the chat
  patterns: z.array(z.object({
    id: z.string().optional(),
    pattern: z.string(),
    explanation: z.string().default(''),
    evidence: z.array(EvidenceRefSchema).max(6).default([]),
    confidence: z.number().min(0).max(1).default(0.85),
  })).max(10).default([]),

  // 4. Contradictions (claim vs reality)
  contradictions: z.array(z.object({
    claim: z.string(),
    laterBehavior: z.string(),
    explanation: z.string().default(''),
    evidence: z.array(EvidenceRefSchema).max(6).default([]),
    confidence: z.number().min(0).max(1).default(0.85),
  })).max(8).default([]),

  // 5. Callbacks across time
  callbacks: z.array(z.object({
    earlier: EvidenceRefSchema,
    later: EvidenceRefSchema,
    connection: z.string().default(''),
    confidence: z.number().min(0).max(1).default(0.85),
  })).max(8).default([]),

  // 6. Foreshadowing
  foreshadowing: z.array(z.object({
    setup: EvidenceRefSchema,
    payoff: EvidenceRefSchema,
    explanation: z.string().default(''),
    confidence: z.number().min(0).max(1).default(0.85),
  })).max(6).default([]),

  // 7. Conversation Lore & Culture
  lore: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    origin: z.string().default(''),
    howItEvolved: z.string().default(''),
    evidence: z.array(EvidenceRefSchema).max(5).default([]),
  })).max(10).default([]),

  // 8. Naturally funny material
  funnyMoments: z.array(z.object({
    moment: z.string(),
    whyFunny: z.string().default(''),
    evidence: z.array(EvidenceRefSchema).max(4).default([]),
  })).max(8).default([]),

  // 9. Relationship turning points
  turningPoints: z.array(z.object({
    title: z.string(),
    description: z.string().default(''),
    evidence: z.array(EvidenceRefSchema).max(4).default([]),
    significance: z.number().min(0).max(1).default(0.85),
  })).max(8).default([]),

  // 10. Plot twists
  plotTwists: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string().default(''),
    beforeContext: z.string().optional(),
    afterContext: z.string().optional(),
    evidence: z.array(EvidenceRefSchema).max(4).default([]),
    significance: z.number().min(0).max(1).default(0.85),
  })).max(6).default([]),

  // 11. Key receipt candidates
  // 11. Key receipt candidates
  receiptCandidates: z.array(z.object({
    reason: z.string().default('Notable message receipt'),
    messageId: z.string(),
    sender: z.string().optional().default(''),
    timestamp: z.string().optional().default(''),
    exactText: z.string().optional().default(''),
    importance: z.number().min(0).max(1).default(0.85),
  })).max(20).default([]),

  // 12. Unresolved threads
  unresolvedThreads: z.array(z.object({
    topic: z.string(),
    context: z.string().default(''),
    evidence: z.array(EvidenceRefSchema).max(6).default([]),
  })).max(8).default([]),

  // 13. Story-relevant insights
  storyInsights: z.array(z.object({
    insight: z.string(),
    evidence: z.array(EvidenceRefSchema).max(6).default([]),
    importance: z.number().min(0).max(1).default(0.85),
  })).max(10).default([]),

  // 14. Internal story blueprint
  overarchingStory: z.object({
    opening: z.string().default(''),
    development: z.string().default(''),
    escalation: z.string().default(''),
    majorTurn: z.string().default(''),
    currentState: z.string().default(''),
    overallDynamic: z.string().default('Conversational dynamic'),
    keyThemes: z.array(z.string()).max(8).default([]),
  }).default({}),

  // 15. Dominant themes
  keyThemes: z.array(z.string()).max(8).default([]),
});


// ─── Global Discovery ────────────────────────────────────────────────────────

export const GlobalDiscoverySchema = z.object({
  dominantThemes: z.array(z.string()),
  majorChanges: z.array(z.object({
    description: z.string(),
    period: z.string(),
    significance: z.number().min(0).max(1),
  })),
  recurringJokes: z.array(z.string()),
  unusualPatterns: z.array(z.string()),
  overallTone: z.string(),
  potentialStoryArcs: z.array(z.string()),
});

// ─── Story Eras ──────────────────────────────────────────────────────────────

export const StoryEraSchema = z.object({
  eras: z.array(z.object({
    id: z.string(),
    title: z.string(),
    startAt: z.string(),
    endAt: z.string(),
    summary: z.string(),
    dominantTopics: z.array(z.string()),
    tone: z.string(),
    importance: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
});

// ─── Character Insights ──────────────────────────────────────────────────────

export const CharacterInsightSchema = z.object({
  characters: z.array(z.object({
    participant: z.string(),
    title: z.string(),
    description: z.string(),
    observableTraits: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
});

// ─── Lore Items ──────────────────────────────────────────────────────────────

export const LoreItemSchema = z.object({
  lore: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    date: z.string(),
    participants: z.array(z.string()),
    funnyScore: z.number().min(0).max(1),
    importance: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
});

// ─── Plot Twists ─────────────────────────────────────────────────────────────

export const PlotTwistSchema = z.object({
  plotTwists: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    beforePeriod: z.string(),
    afterPeriod: z.string(),
    significance: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
});

// ─── Pattern Insights ────────────────────────────────────────────────────────

export const PatternInsightSchema = z.object({
  patterns: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    frequency: z.number(),
    importance: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
}).passthrough();

// ─── Final AfterchatIntelligence ─────────────────────────────────────────────
// UNCHANGED — Phase 4 depends on this schema exactly.

export const AfterchatIntelligenceSchema = z.object({
  overview: z.object({
    dominantThemes: z.array(z.string()),
    overallTone: z.string(),
    potentialStoryArcs: z.array(z.string()),
    recurringJokes: z.array(z.string()),
  }),
  eras: z.array(z.object({
    id: z.string(),
    title: z.string(),
    startAt: z.string(),
    endAt: z.string(),
    summary: z.string(),
    dominantTopics: z.array(z.string()),
    tone: z.string(),
    importance: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
  characters: z.array(z.object({
    participant: z.string(),
    title: z.string(),
    description: z.string(),
    observableTraits: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
  lore: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    date: z.string(),
    participants: z.array(z.string()),
    funnyScore: z.number().min(0).max(1),
    importance: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
  plotTwists: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    beforePeriod: z.string(),
    afterPeriod: z.string(),
    significance: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
  patterns: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    frequency: z.number(),
    importance: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
  })),
});

// ─── Phase 4 Story Schemas ──────────────────────────────────────────────────
// UNCHANGED — do not modify these.

export const StoryChapterSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  period: z.string().default(''),
  narrative: z.string(),
  keyStats: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).default([]),
  evidenceMessageIds: z.array(z.string()).default([]),
});

export const AwardSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  recipient: z.string(),
  reason: z.string(),
  emoji: z.string().default('🏆'),
  evidenceMessageIds: z.array(z.string()).default([]),
});

export const StorySchema = z.object({
  title: z.string(),
  subtitle: z.string().default(''),
  opening: z.string(),
  chapters: z.array(StoryChapterSchema),
  awards: z.array(AwardSchema).default([]),
  verdict: z.object({
    title: z.string(),
    description: z.string(),
    badge: z.string().default('Documented Archive'),
  }),
  ending: z.string().default(''),
});

export const GenerateStoryRequestSchema = z.object({
  intelligence: AfterchatIntelligenceSchema,
  metadata: z.object({
    totalMessages: z.number(),
    totalParticipants: z.number(),
    participants: z.array(z.string()),
    durationDays: z.number(),
    chatType: z.string().optional().nullable(),
    backstory: z.string().optional().nullable(),
  }),
  summaryStats: z.object({
    peakHour: z.string().nullable(),
    peakDay: z.string().nullable(),
    peakMonth: z.string().nullable(),
    longestSilenceDays: z.number().nullable(),
    longestStreakDays: z.number().nullable(),
    mostUsedEmoji: z.string().nullable(),
    topWords: z.array(z.string()),
  }),
});
