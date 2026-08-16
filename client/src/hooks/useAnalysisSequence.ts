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

  const { runAnalysis, status, currentStage, progress, error } = useIntelligence();
  const { analysis, messages } = useChatAnalysis();

  const beginAnalysis = useCallback(async (chatType?: string, backstory?: string) => {
    setIsAnalysing(true);
    setIsReady(false);
    hasStarted.current = true;

    if (!analysis || !messages) {
      setTimeout(() => {
        setIsReady(true);
      }, 1000);
      return;
    }

    try {
      await runAnalysis(analysis, messages, chatType, backstory);
    } finally {
      hasStarted.current = false;
    }

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
    progress,
    aiStatus: status,
    aiError: error,
  };
}
