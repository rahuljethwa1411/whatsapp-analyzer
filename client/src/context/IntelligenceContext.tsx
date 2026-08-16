/**
 * IntelligenceContext
 * Owns Phase 3 AfterchatIntelligence state and the API call.
 * Keeps API key server-side — only structured chunks are sent.
 *
 * Updated for Phase 3 Scalability Refactor:
 * - Progress now shows percentage + friendly stage names
 * - DailyLimitError surfaces with a specific user message
 * - ANALYSIS_INCOMPLETE shows a partial warning instead of failure
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

// ─── Pipeline Stages ─────────────────────────────────────────────────────────

export interface ProgressState {
  stage: string;
  percent: number;
}

const FRIENDLY_STAGES: ProgressState[] = [
  { stage: 'Parsing messages...', percent: 5 },
  { stage: 'Mapping the conversations...', percent: 12 },
  { stage: 'Reading conversation patterns...', percent: 25 },
  { stage: 'Finding recurring moments...', percent: 40 },
  { stage: 'Spotting the themes...', percent: 55 },
  { stage: 'Finding the lore...', percent: 70 },
  { stage: 'Looking for plot twists...', percent: 80 },
  { stage: 'Identifying patterns...', percent: 87 },
  { stage: 'Connecting the receipts...', percent: 93 },
  { stage: 'Your chat is getting suspiciously interesting.', percent: 97 },
];

export type PipelineStage = string;

// ─── Context shape ──────────────────────────────────────────────────────────
interface IntelligenceContextType {
  intelligence: AfterchatIntelligence | null;
  status: 'idle' | 'loading' | 'done' | 'error' | 'partial';
  currentStage: PipelineStage;
  progress: number;
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
function buildMetadata(
  analysis: ChatAnalysis,
  chatType?: string | null,
  backstory?: string | null
) {
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
  const [intelligence, setIntelligence] = useState<AfterchatIntelligence | null>(() => {
    try {
      const saved = localStorage.getItem('afterchat_intelligence');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return null;
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'partial'>(() =>
    localStorage.getItem('afterchat_intelligence') ? 'done' : 'idle'
  );
  const [currentStage, setCurrentStage] = useState<PipelineStage>('');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // In-memory message index for evidence retrieval
  const messageIndexRef = useRef<Map<string, ChatMessage>>(new Map());

  const reset = useCallback(() => {
    setIntelligence(null);
    setStatus('idle');
    setCurrentStage('');
    setProgress(0);
    setError(null);
    messageIndexRef.current = new Map();
    try {
      localStorage.removeItem('afterchat_intelligence');
    } catch { /* ignore */ }
  }, []);

  const getMessagesByIds = useCallback((ids: string[]): ChatMessage[] => {
    if (!Array.isArray(ids)) return [];
    const evidenceById = new Map(
      (intelligence?._evidenceStore ?? [])
        .filter((item) => item?.messageId && item.text)
        .map((item) => [item.messageId, item])
    );

    return ids.flatMap((id) => {
      const rawMessage = messageIndexRef.current.get(id);
      if (rawMessage) return [rawMessage];

      const evidence = evidenceById.get(id);
      if (!evidence) return [];

      return [{
        id: evidence.messageId,
        timestamp: evidence.timestamp ? new Date(evidence.timestamp) : new Date(0),
        sender: evidence.sender ?? null,
        text: evidence.text ?? '',
        type: 'message' as const,
      }];
    });
  }, [intelligence]);

  const runAnalysis = useCallback(
    async (
      analysis: ChatAnalysis,
      messages: ChatMessage[],
      chatType?: string | null,
      backstory?: string | null
    ): Promise<AfterchatIntelligence | null> => {
      setStatus('loading');
      setError(null);
      setProgress(0);
      setCurrentStage(FRIENDLY_STAGES[0].stage);

      // Build in-memory message index for evidence retrieval
      const index = new Map<string, ChatMessage>();
      for (const m of messages) {
        index.set(m.id, m);
      }
      messageIndexRef.current = index;

      // Animate through stages client-side while API processes
      const stageInterval = animateStages(setCurrentStage, setProgress);

      try {
        // Build request payload
        const metadata = buildMetadata(analysis, chatType, backstory);
        const summaryStats = buildSummaryStats(analysis);
        const chunks: AnalysisChunk[] = createAnalysisChunks(
          messages,
          analysis.sessions ?? []
        );

        setCurrentStage('Mapping the conversations...');
        setProgress(8);

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata, summaryStats, chunks }),
        });

        clearInterval(stageInterval);

        // ── Handle specific error codes ─────────────────────────────────
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const code = body?.code;

          if (code === 'DAILY_LIMIT_EXCEEDED') {
            throw new Error(
              "We've hit the daily AI analysis limit. Please try again tomorrow. " +
              "If you need more capacity, consider upgrading the Groq API plan."
            );
          }

          if (code === 'ANALYSIS_INCOMPLETE') {
            // Partial success — don't throw, show warning
            throw new Error(
              'Analysis partially completed — some sections may be shorter than usual. ' +
              'This can happen with very large chats under high API load. ' +
              'The report will still be generated with available data.'
            );
          }

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
        setProgress(97);
        await sleep(400);

        setIntelligence(data.report);
        try {
          localStorage.setItem('afterchat_intelligence', JSON.stringify(data.report));
        } catch { /* ignore */ }
        setStatus('done');
        setCurrentStage('Done.');
        setProgress(100);
        return data.report;

      } catch (err: any) {
        clearInterval(stageInterval);

        const isPartial = err?.message?.includes('partially completed');
        const friendlyMsg = err?.message?.includes('fetch')
          ? 'Could not reach the analysis server. Make sure it is running on port 3001.'
          : err?.message ?? 'Analysis failed. Please try again.';

        setError(friendlyMsg);
        setStatus(isPartial ? 'partial' : 'error');
        setCurrentStage('');
        setProgress(0);
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
        progress,
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
 * Animates through the friendly stage labels client-side.
 * Advances stage every ~3s to simulate progress while the API runs.
 */
function animateStages(
  setStage: (s: PipelineStage) => void,
  setPercent: (n: number) => void
): ReturnType<typeof setInterval> {
  let i = 0;
  const stages = FRIENDLY_STAGES;
  return setInterval(() => {
    i = Math.min(i + 1, stages.length - 1);
    setStage(stages[i].stage);
    setPercent(stages[i].percent);
  }, 3000);
}
