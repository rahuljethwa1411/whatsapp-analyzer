/**
 * AnalysisSequence
 * Loading screen shown while Phase 2 + Phase 3 pipeline runs.
 * Shows real pipeline stage messages from IntelligenceContext.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useChatAnalysis } from '../../context/ChatAnalysisContext';
import { useIntelligence } from '../../context/IntelligenceContext';
import chatExportStory from '../../assets/chat-export-story.png';

const PHASE2_STEPS = [
  'Parsing messages locally...',
  'Mapping your timeline...',
  'Identifying participants...',
  'Calculating peak activity...',
  'Finding streaks & silences...',
];

export function AnalysisSequence({
  ready,
  aiStatus,
  currentStage,
  aiError,
}: {
  ready: boolean;
  aiStatus?: 'idle' | 'loading' | 'done' | 'error';
  currentStage?: string;
  aiError?: string | null;
}) {
  const { analysis } = useChatAnalysis();

  const totalMsgs = analysis?.metadata.totalMessages || 24821;
  const totalPeople = analysis?.metadata.totalParticipants || 4;
  const peakHourStr = analysis?.activity.peakHour?.label || '11 PM';
  const duration = analysis?.metadata.durationDays || 580;

  const phase2Steps = [
    `✓ ${totalMsgs.toLocaleString()} messages parsed locally`,
    `✓ ${duration} days of timeline mapped`,
    `✓ ${totalPeople} participants identified`,
    `✓ Peak activity: ${peakHourStr}`,
    `✓ Streaks & silences calculated`,
  ];

  const isAIRunning = aiStatus === 'loading';
  const hasError = aiStatus === 'error';

  return (
    <main className="analysis">
      <AnimatePresence mode="wait">
        {ready && !hasError ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="eyebrow">ANALYSIS COMPLETE</p>
            <h1>We found something.</h1>
            <p className="lede">Your AfterChat is ready.</p>
            <a className="button" href="/report">
              Enter the story <span>→</span>
            </a>
          </motion.div>
        ) : hasError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="eyebrow">ANALYSIS INCOMPLETE</p>
            <h1>Something went wrong.</h1>
            <p className="lede" style={{ color: 'var(--color-error, #e55)' }}>
              {aiError ?? 'The AI analysis failed. Your local stats are still available.'}
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
              <a className="button" href="/report">
                View local report <span>→</span>
              </a>
              <a className="text-button" href="/upload">
                Try again
              </a>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            className="analysis-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div>
              <p className="eyebrow">BUILDING YOUR CHAT DOCUMENTARY</p>
              <h1>Reading your lore...</h1>
              <p className="analysis-purpose">
                We're turning your exported WhatsApp chat into structured intelligence
                — eras, characters, lore, and the moments you completely forgot about.
              </p>
              <p className="analysis-privacy">
                🔒 Raw messages are never uploaded. Only structured data is sent for AI
                analysis.
              </p>

              {/* Phase 2 steps — always shown */}
              <div className="checks">
                {phase2Steps.map((step, index) => (
                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.35 }}
                    key={step}
                  >
                    {step}
                  </motion.p>
                ))}
              </div>

              {/* Phase 3 AI stage — shown when AI is running */}
              {isAIRunning && currentStage && (
                <motion.div
                  className="ai-stage-indicator"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8 }}
                >
                  <div className="ai-stage-dot" />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentStage}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.3 }}
                    >
                      {currentStage}
                    </motion.span>
                  </AnimatePresence>
                </motion.div>
              )}
            </div>

            <motion.figure
              className="analysis-illustration"
              initial={{ opacity: 0, rotate: 2 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
            >
              <img
                src={chatExportStory}
                alt="An exported group chat transforming into a story"
              />
              <figcaption>Chat export → your story</figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
