/**
 * useAnalysisSequence
 * Orchestrates the full Phase 2 → Phase 3 flow:
 * 1. Triggers when beginAnalysis() is called
 * 2. Calls runAnalysis() from IntelligenceContext (real API call)
 * 3. On success → navigates to /report
 * 4. Exposes isAnalysing, isReady, currentStage, error
 */

import { useState, useCallback, useRef } from 'react';
import { useIntelligence } from '../context/IntelligenceContext';
import { useChatAnalysis } from '../context/ChatAnalysisContext';

export function useAnalysisSequence() {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const hasStarted = useRef(false);

  const { runAnalysis, status, currentStage, error } = useIntelligence();
  const { analysis, messages } = useChatAnalysis();

  const beginAnalysis = useCallback(async (chatType?: string, backstory?: string) => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    setIsAnalysing(true);

    if (!analysis || !messages) {
      // Fallback: no data yet — just navigate (will show mock data)
      setTimeout(() => {
        setIsReady(true);
      }, 1000);
      return;
    }

    await runAnalysis(analysis, messages, chatType, backstory);

    setIsReady(true);

    // Small delay before navigation so the user sees "Done."
    setTimeout(() => {
      window.location.href = '/report';
    }, 900);
  }, [analysis, messages, runAnalysis]);

  return {
    isAnalysing,
    isReady,
    beginAnalysis,
    currentStage,
    aiStatus: status,
    aiError: error,
  };
}
