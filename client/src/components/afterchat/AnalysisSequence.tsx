/**
 * Editorial Investigation Sequence
 *
 * Replaces generic AI tropes with an authentic true-crime documentary aesthetic:
 * - Clean editorial case file styling
 * - Live message counter
 * - Witty observational receipt teasers
 * - Two-tier entrance selection (Free Teaser vs Full 6-Page Dossier)
 */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useChatAnalysis } from '../../context/ChatAnalysisContext';
import { useStory } from '../../context/StoryContext';

const LIVE_TEASERS = [
  'Reading through the 2 AM hostage negotiations and unread rants...',
  'Cataloging every Goa and Delhi trip plan that died on MakeMyTrip...',
  'Logging every phone call that was terminated mid-sentence...',
  'Measuring the exact week the unbothered facade collapsed into clinginess...',
  'Assigning unprovoked blame for cricket match wickets...',
  'Recovering forgotten inside jokes and late-night catchphrases...',
  'Drafting the official Satirical Awards ceremony...',
  'Securing verified receipts for the opening chapters...',
];

const CASE_TRIVIA = [
  {
    q: 'Who filed more complaints about cut calls?',
    hint: 'Checking timestamp gaps and unreturned voicenotes...',
  },
  {
    q: 'How many vacation itineraries were proposed?',
    hint: 'Scanning flight fare screenshots and immediate crying emojis...',
  },
  {
    q: 'What was the longest period of cold-war silence?',
    hint: 'Verifying gap records across the timeline...',
  },
];

export function AnalysisSequence({
  ready,
  aiStatus,
  currentStage,
  aiError,
  progress,
}: {
  ready: boolean;
  aiStatus?: 'idle' | 'loading' | 'done' | 'error' | 'partial';
  currentStage?: string;
  aiError?: string | null;
  progress?: number;
}) {
  const { analysis } = useChatAnalysis();
  const { setAccessMode } = useStory();

  const totalMsgs = analysis?.metadata.totalMessages || 23979;
  const participants = analysis?.metadata.participants || ['Rahul', 'iteeca💫'];
  const peakHourStr = analysis?.activity.peakHour?.label || '12:00 AM';
  const duration = analysis?.metadata.durationDays || 344;
  const topEmoji = analysis?.emojis.mostUsedEmoji || '😭';

  const [counter, setCounter] = useState(0);
  const [teaserIdx, setTeaserIdx] = useState(0);
  const [activeTrivia, setActiveTrivia] = useState(0);
  const [triviaRevealed, setTriviaRevealed] = useState(false);

  // Animated message counter
  useEffect(() => {
    let start = 0;
    const end = totalMsgs;
    const durationMs = 1600;
    const increment = Math.ceil(end / (durationMs / 30));

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCounter(end);
        clearInterval(timer);
      } else {
        setCounter(start);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [totalMsgs]);

  // Rotate teasers
  useEffect(() => {
    const interval = setInterval(() => {
      setTeaserIdx((prev) => (prev + 1) % LIVE_TEASERS.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  const isAIRunning = aiStatus === 'loading';
  const hasError = aiStatus === 'error';
  const isPartial = aiStatus === 'partial';
  const progressPct = progress ?? Math.min(95, Math.round((counter / totalMsgs) * 80));

  const handleSelectPlan = (mode: 'preview' | 'full') => {
    setAccessMode(mode);
    window.location.href = '/report';
  };

  return (
    <main className="analysis interactive-analysis-wrapper">
      <AnimatePresence mode="wait">
        {ready && !hasError ? (
          <motion.div
            key="done"
            className="analysis-plan-selection-container"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div className="plan-selection-header">
              <span className="case-status-badge">CLASSIFIED DOSSIER COMPILED</span>
              <h1 className="plan-selection-title">Choose how to enter your story</h1>
              <p className="plan-selection-subtitle">
                Indexed <b>{totalMsgs.toLocaleString()} messages</b> between <b>{participants.join(' & ')}</b> across <b>{duration} days</b>.
              </p>
            </div>

            {/* Side-by-Side Tier Selection Grid */}
            <div className="plan-tiers-grid">
              {/* TIER 1: FREE PREVIEW */}
              <div className="plan-tier-card plan-tier-free">
                <div className="plan-tier-top">
                  <span className="tier-tag-pill free-tag">FREE PREVIEW</span>
                  <h2 className="tier-title">The Teaser</h2>
                  <div className="tier-price-box">
                    <b className="tier-price-amount">₹0</b>
                    <small>Free preview archive</small>
                  </div>
                  <p className="tier-desc">Core conversation statistics, telemetry, and opening narrative chapters.</p>
                </div>

                <ul className="tier-feature-list">
                  <li className="feature-item positive">
                    <span className="icon">✓</span>
                    <span>Full chat statistics & telemetry</span>
                  </li>
                  <li className="feature-item positive">
                    <span className="icon">✓</span>
                    <span><b>Chapters 01 & 02</b> (Origin & First Trip Plans)</span>
                  </li>
                  <li className="feature-item positive">
                    <span className="icon">✓</span>
                    <span><b>First 2 Story Eras</b> with receipts</span>
                  </li>
                  <li className="feature-item locked">
                    <span className="icon">🔒</span>
                    <span>Remaining 8 Story Chapters</span>
                  </li>
                  <li className="feature-item locked">
                    <span className="icon">🔒</span>
                    <span>Cast Dossiers & Character Archetypes</span>
                  </li>
                  <li className="feature-item locked">
                    <span className="icon">🔒</span>
                    <span>Inside Joke Lore & Meme Origins</span>
                  </li>
                  <li className="feature-item locked">
                    <span className="icon">🔒</span>
                    <span>Satirical Awards Ceremony</span>
                  </li>
                  <li className="feature-item locked">
                    <span className="icon">🔒</span>
                    <span>Downloadable 6-Page PDF Case File</span>
                  </li>
                </ul>

                <button
                  type="button"
                  className="button tier-cta-btn tier-free-btn"
                  onClick={() => handleSelectPlan('preview')}
                >
                  View Free Teaser <span>→</span>
                </button>
              </div>

              {/* TIER 2: FULL 6-PAGE DOSSIER */}
              <div className="plan-tier-card plan-tier-premium">
                <div className="plan-tier-badge-top">
                  <span>INTRODUCTORY RATE • SAVE 45%</span>
                </div>

                <div className="plan-tier-top">
                  <span className="tier-tag-pill premium-tag">FULL 6-PAGE CASE FILE</span>
                  <h2 className="tier-title">The Complete Dossier</h2>
                  <div className="tier-price-box">
                    <div className="premium-price-row">
                      <span className="old-price">₹999</span>
                      <b className="tier-price-amount premium-amount">₹549</b>
                    </div>
                    <small>One-time unlock • Lifetime archive access</small>
                  </div>
                  <p className="tier-desc">The complete unedited investigation covering every chapter, era, kalesh, and receipt.</p>
                </div>

                <ul className="tier-feature-list">
                  <li className="feature-item positive premium-feat">
                    <span className="icon">✓</span>
                    <span><b>Everything in Free Preview</b></span>
                  </li>
                  <li className="feature-item positive premium-feat">
                    <span className="icon">✓</span>
                    <span><b>ALL 10 Documentary Chapters</b> (250 words each)</span>
                  </li>
                  <li className="feature-item positive premium-feat">
                    <span className="icon">✓</span>
                    <span><b>All Story Eras</b> (100–250 word breakdowns)</span>
                  </li>
                  <li className="feature-item positive premium-feat">
                    <span className="icon">✓</span>
                    <span><b>Complete Cast Dossiers</b> (Self-image vs reality)</span>
                  </li>
                  <li className="feature-item positive premium-feat">
                    <span className="icon">✓</span>
                    <span><b>Inside Joke Lore & Catchphrase Origins</b></span>
                  </li>
                  <li className="feature-item positive premium-feat">
                    <span className="icon">✓</span>
                    <span><b>Satirical Awards Ceremony</b> (Custom roasts)</span>
                  </li>
                  <li className="feature-item positive premium-feat">
                    <span className="icon">✓</span>
                    <span><b>Official Final Verdict & Shareable IG Card</b></span>
                  </li>
                  <li className="feature-item positive premium-feat">
                    <span className="icon">✓</span>
                    <span><b>1-Click Download Classified 6-Page PDF</b></span>
                  </li>
                </ul>

                <button
                  type="button"
                  className="button tier-cta-btn tier-premium-btn"
                  onClick={() => handleSelectPlan('full')}
                >
                  Unlock Full 6-Page Dossier (₹549) <span>→</span>
                </button>

                <div className="tier-guarantee-row">
                  <span>🔒 Instant Unlock</span>
                  <span>⚡ 100% Private</span>
                  <span>📱 Shareable</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : isPartial ? (
          <motion.div
            key="partial"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="eyebrow">PARTIAL REPORT</p>
            <h1>Almost there.</h1>
            <p className="lede" style={{ color: 'var(--color-warning, #f5a623)' }}>
              {aiError ?? 'Analysis partially completed. Your report will be generated with available data.'}
            </p>
            <a className="button" href="/report">
              View Report <span>→</span>
            </a>
          </motion.div>
        ) : hasError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="eyebrow">REPORT NOTICE</p>
            <h1>Investigation interrupted.</h1>
            <p className="lede" style={{ color: 'var(--color-error, #e55)' }}>
              {aiError ?? 'The analysis encountered a delay. Local telemetry remains fully accessible.'}
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
              <a className="button" href="/report">
                View Local Stats <span>→</span>
              </a>
              <a className="text-button" href="/upload">
                Try Again
              </a>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            className="analysis-interactive-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Top Case Header */}
            <div className="analysis-radar-header">
              <div className="case-status-indicator">
                <span className="case-pulse-dot" />
                <span className="case-status-text">CASE FILE IN PROGRESS • READING ARCHIVE</span>
              </div>
              <h2 className="analysis-dynamic-headline">
                {currentStage || 'Examining conversation history...'}
              </h2>
            </div>

            {/* Live Progress Card with Ticking Numbers */}
            <div className="analysis-progress-card">
              <div className="progress-numbers-row">
                <span className="live-scanned-count">
                  <b>{counter.toLocaleString()}</b> / {totalMsgs.toLocaleString()} MESSAGES EXAMINED
                </span>
                <span className="progress-pct-badge">{Math.min(99, Math.max(12, progressPct))}%</span>
              </div>
              <div className="progress-track-custom">
                <motion.div
                  className="progress-fill-custom"
                  animate={{ width: `${Math.min(99, Math.max(12, progressPct))}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>

              {/* Dynamic Live Teaser Ticker */}
              <div className="live-ticker-box">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={teaserIdx}
                    className="live-ticker-text"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.25 }}
                  >
                    {LIVE_TEASERS[teaserIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            {/* Quick Live Discovery Cards */}
            <div className="live-discoveries-grid">
              <motion.div
                className="discovery-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <span className="disc-icon">📁</span>
                <div className="disc-info">
                  <small>SUBJECTS</small>
                  <b>{participants.join(' & ')}</b>
                </div>
              </motion.div>

              <motion.div
                className="discovery-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <span className="disc-icon">🌙</span>
                <div className="disc-info">
                  <small>PEAK HOUR</small>
                  <b>{peakHourStr}</b>
                </div>
              </motion.div>

              <motion.div
                className="discovery-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                <span className="disc-icon">🗓️</span>
                <div className="disc-info">
                  <small>SPAN</small>
                  <b>{duration} Days Recorded</b>
                </div>
              </motion.div>

              <motion.div
                className="discovery-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <span className="disc-icon">{topEmoji}</span>
                <div className="disc-info">
                  <small>TOP REACTION</small>
                  <b>Most Used</b>
                </div>
              </motion.div>
            </div>

            {/* Pass-Time Trivia Box */}
            <div className="wait-trivia-card">
              <div className="trivia-top">
                <span className="trivia-badge">CHAT ARCHIVE CLUE</span>
                <p className="trivia-prompt">{CASE_TRIVIA[activeTrivia].q}</p>
              </div>

              <div className="trivia-action-row">
                <button
                  type="button"
                  className="trivia-reveal-btn"
                  onClick={() => setTriviaRevealed(!triviaRevealed)}
                >
                  {triviaRevealed ? 'Hide Clue' : 'Read Observation'}
                </button>
                <button
                  type="button"
                  className="trivia-next-btn"
                  onClick={() => {
                    setActiveTrivia((prev) => (prev + 1) % CASE_TRIVIA.length);
                    setTriviaRevealed(false);
                  }}
                >
                  Next Clue ↻
                </button>
              </div>

              {triviaRevealed && (
                <motion.div
                  className="trivia-answer-box"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <p>{CASE_TRIVIA[activeTrivia].hint}</p>
                </motion.div>
              )}
            </div>

            <p className="analysis-privacy-note">
              🔒 Private: All {totalMsgs.toLocaleString()} messages examined in memory on your device.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
