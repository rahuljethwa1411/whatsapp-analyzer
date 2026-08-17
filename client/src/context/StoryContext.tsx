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

import { buildFallbackStory } from '../lib/storyFallback';

interface StoryContextType {
  story: Story | null;
  status: 'idle' | 'loading' | 'done' | 'error';
  error: string | null;
  accessMode: ReportAccess;
  setAccessMode: (mode: ReportAccess) => void;
  generateStory: (
    intelligence: AfterchatIntelligence | null,
    analysis: ChatAnalysis
  ) => Promise<Story | null>;
  resetStory: () => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export function StoryProvider({ children }: { children: ReactNode }) {
  const [story, setStory] = useState<Story | null>(() => {
    try {
      const saved = localStorage.getItem('afterchat_story');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return null;
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(() =>
    localStorage.getItem('afterchat_story') ? 'done' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<ReportAccess>('preview');

  const resetStory = useCallback(() => {
    setStory(null);
    setStatus('idle');
    setError(null);
    try {
      localStorage.removeItem('afterchat_story');
    } catch { /* ignore */ }
  }, []);

  const generateStory = useCallback(
    async (
      intelligence: AfterchatIntelligence | null,
      analysis: ChatAnalysis
    ): Promise<Story | null> => {
      setStatus('loading');
      setError(null);

      // Pre-generate safe fallback story built from intelligence eras & lore
      const fallback = buildFallbackStory(intelligence, analysis);

      // Set fallback story immediately so chapters reflect extracted eras
      setStory(fallback);
      try {
        localStorage.setItem('afterchat_story', JSON.stringify(fallback));
      } catch { /* ignore */ }

      if (!intelligence) {
        setStatus('done');
        return fallback;
      }

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

        // 60 second timeout for 70B full 10-chapter story generation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const res = await fetch('/api/story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ intelligence, metadata, summaryStats }),
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Story API returned status ${res.status}`);
        }

        const data = await res.json();
        if (!data.success || !data.story) {
          throw new Error(data.error || 'Failed to generate narrative story.');
        }

        setStory(data.story);
        try {
          localStorage.setItem('afterchat_story', JSON.stringify(data.story));
        } catch { /* ignore */ }
        setStatus('done');
        return data.story;
      } catch (err: any) {
        console.warn('[StoryContext] Using fallback story due to:', err.message);
        // Seamless fallback — report is 100% complete
        setStory(fallback);
        try {
          localStorage.setItem('afterchat_story', JSON.stringify(fallback));
        } catch { /* ignore */ }
        setStatus('done');
        return fallback;
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
