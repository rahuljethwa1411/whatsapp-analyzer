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

// ─── Chunk Extraction ────────────────────────────────────────────────────────

export const ChunkInsightSchema = z.object({
  chunkId: z.string(),
  topics: z.array(z.string()),
  events: z.array(z.object({
    title: z.string(),
    description: z.string(),
    importance: z.number().min(0).max(1),
    messageIds: z.array(z.string()),
  })),
  moments: z.array(z.object({
    type: z.enum(['funny', 'dramatic', 'absurd', 'wholesome', 'conflict', 'plan', 'lore']),
    title: z.string(),
    description: z.string(),
    importance: z.number().min(0).max(1),
    messageIds: z.array(z.string()),
  })),
  recurringPhrases: z.array(z.string()),
  toneSignals: z.array(z.string()),
  activityNote: z.string().optional(),
});

// ─── Chat Memory ─────────────────────────────────────────────────────────────

export const ChatMemorySchema = z.object({
  periods: z.array(z.object({
    dateRange: z.string(),
    topics: z.array(z.string()),
    events: z.array(z.object({
      title: z.string(),
      messageIds: z.array(z.string()),
    })),
    toneSignals: z.array(z.string()),
    messageCount: z.number(),
  })),
  globalTopics: z.array(z.string()),
  recurringPhrases: z.array(z.string()),
  allEventTitles: z.array(z.string()),
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
});

// ─── Final AfterchatIntelligence ─────────────────────────────────────────────

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

export const StoryChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  period: z.string(),
  narrative: z.string(),
  keyStats: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })),
  evidenceMessageIds: z.array(z.string()),
});

export const AwardSchema = z.object({
  id: z.string(),
  title: z.string(),
  recipient: z.string(),
  reason: z.string(),
  emoji: z.string(),
  evidenceMessageIds: z.array(z.string()),
});

export const StorySchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  opening: z.string(),
  chapters: z.array(StoryChapterSchema),
  awards: z.array(AwardSchema),
  verdict: z.object({
    title: z.string(),
    description: z.string(),
    badge: z.string(),
  }),
  ending: z.string(),
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

