/**
 * useAnalysisSequence
 * Orchestrates the full end-to-end analysis sequence:
 * 1. Extraction & Global Memory Synthesis (/api/analyze)
 * 2. Complete 10-Chapter Story + Awards + Verdict Generation (/api/story with gpt-5-mini)
 * 3. On 100% completion → transitions seamlessly to /report with everything ready.
 */

import { useState, useCallback, useRef } from 'react';
import { useIntelligence } from '../context/IntelligenceContext';
import { useChatAnalysis } from '../context/ChatAnalysisContext';
import { useStory } from '../context/StoryContext';

export function useAnalysisSequence() {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const hasStarted = useRef(false);

  const { runAnalysis, status, currentStage, progress, error } = useIntelligence();
  const { analysis, messages } = useChatAnalysis();
  const { generateStory } = useStory();

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
      // Step 1: Run 20-chunk extractions & global intelligence memory
      const intel = await runAnalysis(analysis, messages, chatType, backstory);

      // Step 2: Run complete 10-chapter story generation with gpt-5-mini while in analyzer window
      if (intel) {
        await generateStory(intel, analysis);
      }
    } catch (err) {
      console.error('[AnalysisSequence] Error during pipeline execution:', err);
    } finally {
      hasStarted.current = false;
    }

    setIsReady(true);

    // Small delay before navigation so the user sees "Done. Your classified case file is ready."
    setTimeout(() => {
      window.location.href = '/report';
    }, 1000);
  }, [analysis, messages, runAnalysis, generateStory]);

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
