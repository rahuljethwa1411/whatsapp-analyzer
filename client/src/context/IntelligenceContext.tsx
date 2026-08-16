/**
 * IntelligenceContext
 * Owns Phase 3 AfterchatIntelligence state and the API call.
 * Keeps API key server-side — only structured chunks are sent.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AfterchatIntelligence, AnalysisChunk } from '../types/intelligence';
import { ChatMessage } from '../types/chat';
import { ChatAnalysis } from '../types/analysis';
import { createAnalysisChunks } from '../lib/chunker';

// ─── Stage messages shown in the loading screen ────────────────────────────
export const PIPELINE_STAGES = [
  'Reading your chat...',
  'Mapping the conversations...',
  'Finding recurring themes...',
  'Remembering the important moments...',
  'Looking for plot twists...',
  'Finding the lore...',
  'Connecting the receipts...',
  'Putting the pieces together...',
  'Your chat is getting suspiciously interesting.',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number] | string;

// ─── Context shape ──────────────────────────────────────────────────────────
interface IntelligenceContextType {
  intelligence: AfterchatIntelligence | null;
  status: 'idle' | 'loading' | 'done' | 'error';
  currentStage: PipelineStage;
  error: string | null;
  runAnalysis: (
    analysis: ChatAnalysis,
    messages: ChatMessage[],
    chatType?: string | null,
    backstory?: string | null
  ) => Promise<AfterchatIntelligence | null>;
  reset: () => void;
  getMessagesByIds: (ids: string[]) => ChatMessage[];
}

const IntelligenceContext = createContext<IntelligenceContextType | undefined>(
  undefined
);

// ─── Build summaryStats from ChatAnalysis ───────────────────────────────────
function buildSummaryStats(analysis: ChatAnalysis) {
  return {
    peakHour: analysis.activity.peakHour?.label ?? null,
    peakDay: analysis.activity.peakDay?.dayName ?? null,
    peakMonth: analysis.activity.peakMonth?.monthName ?? null,
    longestSilenceDays: analysis.streaks.longestSilence?.durationDays ?? null,
    longestStreakDays: analysis.streaks.longestActiveStreak?.durationDays ?? null,
    mostUsedEmoji: analysis.emojis.mostUsedEmoji ?? null,
    topWords: analysis.words.topWords?.slice(0, 10).map((w) => w.word) ?? [],
  };
}

// ─── Build metadata from ChatAnalysis ──────────────────────────────────────
function buildMetadata(analysis: ChatAnalysis, chatType?: string | null, backstory?: string | null) {
  return {
    totalMessages: analysis.metadata.totalMessages,
    totalParticipants: analysis.metadata.totalParticipants,
    participants: analysis.metadata.participants,
    durationDays: analysis.metadata.durationDays,
    mediaMessageCount: analysis.metadata.mediaMessageCount,
    systemMessageCount: analysis.metadata.systemMessageCount,
    firstMessageAt: analysis.metadata.firstMessageAt?.toISOString() ?? null,
    lastMessageAt: analysis.metadata.lastMessageAt?.toISOString() ?? null,
    chatType: chatType ?? null,
    backstory: backstory ?? null,
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────
export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const [intelligence, setIntelligence] = useState<AfterchatIntelligence | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [currentStage, setCurrentStage] = useState<PipelineStage>('');
  const [error, setError] = useState<string | null>(null);

  // In-memory message index for evidence retrieval
  const messageIndexRef = useRef<Map<string, ChatMessage>>(new Map());

  const reset = useCallback(() => {
    setIntelligence(null);
    setStatus('idle');
    setCurrentStage('');
    setError(null);
    messageIndexRef.current = new Map();
  }, []);

  const getMessagesByIds = useCallback((ids: string[]): ChatMessage[] => {
    if (!Array.isArray(ids)) return [];
    return ids
      .filter((id) => messageIndexRef.current.has(id))
      .map((id) => messageIndexRef.current.get(id)!);
  }, []);

  const runAnalysis = useCallback(
    async (
      analysis: ChatAnalysis,
      messages: ChatMessage[],
      chatType?: string | null,
      backstory?: string | null
    ): Promise<AfterchatIntelligence | null> => {
      setStatus('loading');
      setError(null);
      setCurrentStage(PIPELINE_STAGES[0]);

      // Build in-memory message index for evidence retrieval
      const index = new Map<string, ChatMessage>();
      for (const m of messages) {
        index.set(m.id, m);
      }
      messageIndexRef.current = index;

      // Animate through initial stages client-side while we wait for the API
      const stageInterval = animateStages(setCurrentStage);

      try {
        // Build request payload
        const metadata = buildMetadata(analysis, chatType, backstory);
        const summaryStats = buildSummaryStats(analysis);
        const chunks: AnalysisChunk[] = createAnalysisChunks(
          messages,
          analysis.sessions ?? [],
        );

        setCurrentStage('Mapping the conversations...');

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata, summaryStats, chunks }),
        });

        clearInterval(stageInterval);

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const msg =
            body?.error ??
            `Server error ${response.status}. Please try again.`;
          throw new Error(msg);
        }

        const data = await response.json();
        if (!data.success || !data.report) {
          throw new Error(data.error ?? 'Analysis returned an unexpected result.');
        }

        setCurrentStage('Connecting the receipts...');
        await sleep(400);

        setIntelligence(data.report);
        setStatus('done');
        setCurrentStage('Done.');
        return data.report;
      } catch (err: any) {
        clearInterval(stageInterval);
        const friendlyMsg =
          err?.message?.includes('fetch')
            ? 'Could not reach the analysis server. Make sure it is running on port 3001.'
            : err?.message ?? 'Analysis failed. Please try again.';
        setError(friendlyMsg);
        setStatus('error');
        setCurrentStage('');
        return null;
      }
    },
    []
  );

  return (
    <IntelligenceContext.Provider
      value={{
        intelligence,
        status,
        currentStage,
        error,
        runAnalysis,
        reset,
        getMessagesByIds,
      }}
    >
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligence() {
  const ctx = useContext(IntelligenceContext);
  if (!ctx) throw new Error('useIntelligence must be used within IntelligenceProvider');
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Cycles through stage messages client-side while API is running.
 * Returns the interval ID so it can be cleared on completion.
 */
function animateStages(
  setStage: (s: PipelineStage) => void
): ReturnType<typeof setInterval> {
  let i = 0;
  const stages = PIPELINE_STAGES;
  return setInterval(() => {
    i = (i + 1) % stages.length;
    setStage(stages[i]);
  }, 2800);
}
