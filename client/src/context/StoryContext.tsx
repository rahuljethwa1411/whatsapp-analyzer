/**
 * StoryContext
 * Manages Phase 4 AI story generation state and access level ('preview' | 'full').
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { Story, ReportAccess } from '../types/story';
import { AfterchatIntelligence } from '../types/intelligence';
import { ChatAnalysis } from '../types/analysis';

interface StoryContextType {
  story: Story | null;
  status: 'idle' | 'loading' | 'done' | 'error';
  error: string | null;
  accessMode: ReportAccess;
  setAccessMode: (mode: ReportAccess) => void;
  generateStory: (
    intelligence: AfterchatIntelligence,
    analysis: ChatAnalysis
  ) => Promise<Story | null>;
  resetStory: () => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export function StoryProvider({ children }: { children: ReactNode }) {
  const [story, setStory] = useState<Story | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<ReportAccess>('preview');

  const resetStory = useCallback(() => {
    setStory(null);
    setStatus('idle');
    setError(null);
  }, []);

  const generateStory = useCallback(
    async (
      intelligence: AfterchatIntelligence,
      analysis: ChatAnalysis
    ): Promise<Story | null> => {
      setStatus('loading');
      setError(null);

      try {
        const metadata = {
          totalMessages: analysis.metadata.totalMessages,
          totalParticipants: analysis.metadata.totalParticipants,
          participants: analysis.metadata.participants,
          durationDays: analysis.metadata.durationDays,
        };

        const summaryStats = {
          peakHour: analysis.activity.peakHour?.label ?? null,
          peakDay: analysis.activity.peakDay?.dayName ?? null,
          peakMonth: analysis.activity.peakMonth?.monthName ?? null,
          longestSilenceDays: analysis.streaks.longestSilence?.durationDays ?? null,
          longestStreakDays: analysis.streaks.longestActiveStreak?.durationDays ?? null,
          mostUsedEmoji: analysis.emojis.mostUsedEmoji ?? null,
          topWords: analysis.words.topWords?.slice(0, 10).map((w) => w.word) ?? [],
        };

        const res = await fetch('/api/story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intelligence, metadata, summaryStats }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Story generation failed with status ${res.status}`);
        }

        const data = await res.json();
        if (!data.success || !data.story) {
          throw new Error(data.error || 'Failed to generate narrative story.');
        }

        setStory(data.story);
        setStatus('done');
        return data.story;
      } catch (err: any) {
        console.warn('[StoryContext] Generation error:', err.message);
        setError(err.message || 'Failed to generate narrative story.');
        setStatus('error');
        return null;
      }
    },
    []
  );

  return (
    <StoryContext.Provider
      value={{
        story,
        status,
        error,
        accessMode,
        setAccessMode,
        generateStory,
        resetStory,
      }}
    >
      {children}
    </StoryContext.Provider>
  );
}

export function useStory() {
  const ctx = useContext(StoryContext);
  if (!ctx) throw new Error('useStory must be used within StoryProvider');
  return ctx;
}
