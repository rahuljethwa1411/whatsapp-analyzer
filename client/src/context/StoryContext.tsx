/**
 * StoryContext
 * Manages Phase 4 AI story generation state and access level ('preview' | 'full').
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Story, ReportAccess } from '../types/story';
import { AfterchatIntelligence } from '../types/intelligence';
import { ChatAnalysis } from '../types/analysis';

import { buildFallbackStory } from '../lib/storyFallback';

import { APP_CONFIG } from '../config/appConfig';

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

  const [accessMode, setAccessModeState] = useState<ReportAccess>(() => {
    if (APP_CONFIG.UNLOCK_ALL) return 'full';
    try {
      // Only keep 'full' if cryptographically verified by server payment
      const paid = sessionStorage.getItem('afterchat_payment_verified');
      if (paid === 'true') return 'full';
    } catch { /* ignore */ }
    return 'preview';
  });

  // Verify cryptographic email unlock token on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.search) return;
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('payment_id');
    const token = params.get('token');

    if (paymentId && token) {
      fetch('/api/verify-unlock-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId, token }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && data?.valid) {
            setAccessModeState('full');
            if (data.reportSnapshot) {
              if (data.reportSnapshot.story) {
                setStory(data.reportSnapshot.story);
                setStatus('done');
                try {
                  localStorage.setItem('afterchat_story', JSON.stringify(data.reportSnapshot.story));
                } catch { /* ignore */ }
              }
              if (data.reportSnapshot.analysis) {
                try {
                  localStorage.setItem('afterchat_analysis', JSON.stringify(data.reportSnapshot.analysis));
                } catch { /* ignore */ }
              }
              if (data.reportSnapshot.intelligence) {
                try {
                  localStorage.setItem('afterchat_intelligence', JSON.stringify(data.reportSnapshot.intelligence));
                } catch { /* ignore */ }
              }
            }
            try {
              sessionStorage.setItem('afterchat_payment_verified', 'true');
              localStorage.setItem('afterchat_access_mode', 'full');
            } catch { /* ignore */ }
          }
        })
        .catch((err) => {
          console.warn('[StoryContext] Token verification failed:', err);
        });
    }
  }, []);

  const setAccessMode = useCallback((mode: ReportAccess) => {
    setAccessModeState(mode);
    try {
      if (mode === 'full') {
        sessionStorage.setItem('afterchat_payment_verified', 'true');
      } else {
        sessionStorage.removeItem('afterchat_payment_verified');
      }
      localStorage.setItem('afterchat_access_mode', mode);
    } catch { /* ignore */ }
  }, []);

  const resetStory = useCallback(() => {
    setStory(null);
    setStatus('idle');
    setError(null);
    setAccessModeState(APP_CONFIG.UNLOCK_ALL ? 'full' : 'preview');
    try {
      sessionStorage.removeItem('afterchat_payment_verified');
      localStorage.removeItem('afterchat_story');
      localStorage.removeItem('afterchat_access_mode');
    } catch { /* ignore */ }
  }, []);

  const generateStory = useCallback(
    async (
      intelligence: AfterchatIntelligence | null,
      analysis: ChatAnalysis
    ): Promise<Story | null> => {
      // Deduplicate: if story is already generated or currently loading, avoid redundant API calls
      if (story && status === 'done') {
        return story;
      }

      setStatus('loading');
      setError(null);

      // Pre-generate dynamic fallback built from real intelligence eras & lore
      const fallback = buildFallbackStory(intelligence, analysis);

      if (!intelligence) {
        setStory(fallback);
        try {
          localStorage.setItem('afterchat_story', JSON.stringify(fallback));
        } catch { /* ignore */ }
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

        // 120 second timeout for deep reasoning story generation (gpt-5-mini)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

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
