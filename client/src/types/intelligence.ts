// Phase 3 Client Types
// AfterchatIntelligence and all sub-types

export type AnalysisChunk = {
  id: string;
  startAt: string;
  endAt: string;
  sessionIds: string[];
  participants: string[];
  messages: {
    id: string;
    timestamp: string;
    sender: string | null;
    text: string;
    type: 'message' | 'system' | 'media';
  }[];
};

export type StoryEra = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  summary: string;
  dominantTopics: string[];
  tone: string;
  importance: number;
  evidenceMessageIds: string[];
};

export type CharacterInsight = {
  participant: string;
  title: string;
  description: string;
  observableTraits: string[];
  confidence: number;
  evidenceMessageIds: string[];
};

export type LoreItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  participants: string[];
  funnyScore: number;
  importance: number;
  evidenceMessageIds: string[];
};

export type PlotTwist = {
  id: string;
  title: string;
  description: string;
  beforePeriod: string;
  afterPeriod: string;
  significance: number;
  evidenceMessageIds: string[];
};

export type PatternInsight = {
  id: string;
  title: string;
  description: string;
  frequency: number;
  importance: number;
  evidenceMessageIds: string[];
};

export type EvidenceStoreItem = {
  messageId: string;
  type?: string;
  importance?: number;
  connection?: string;
  sender?: string | null;
  timestamp?: string;
  text?: string;
  tags?: string[];
};

export type AfterchatIntelligence = {
  overview: {
    dominantThemes: string[];
    overallTone: string;
    potentialStoryArcs: string[];
    recurringJokes: string[];
  };
  eras: StoryEra[];
  characters: CharacterInsight[];
  lore: LoreItem[];
  plotTwists: PlotTwist[];
  patterns: PatternInsight[];
  _evidenceStore?: EvidenceStoreItem[];
};

export type IntelligenceStatus = 'idle' | 'loading' | 'done' | 'error';
