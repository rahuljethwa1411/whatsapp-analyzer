// Phase 4 Story Types

export type StoryStat = {
  label: string;
  value: string;
};

export type StoryChapter = {
  id: string;
  title: string;
  period: string;
  narrative: string;
  keyStats: StoryStat[];
  evidenceMessageIds: string[];
};

export type Award = {
  id: string;
  title: string;
  recipient: string;
  reason: string;
  emoji: string;
  evidenceMessageIds: string[];
};

export type StoryVerdict = {
  title: string;
  description: string;
  badge: string;
};

export type Story = {
  title: string;
  subtitle: string;
  opening: string;
  chapters: StoryChapter[];
  awards: Award[];
  verdict: StoryVerdict;
  ending: string;
};

export type ReportAccess = 'preview' | 'full';
