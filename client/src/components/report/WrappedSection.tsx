/**
 * WrappedSection Component
 * Spotify Wrapped-style high-impact fullscreen stat slides.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatAnalysis } from '../../types/analysis';

interface WrappedSectionProps {
  analysis: ChatAnalysis | null;
}

export function WrappedSection({ analysis }: WrappedSectionProps) {
  const [slideIdx, setSlideIdx] = useState(0);

  const totalMsgs = analysis ? analysis.metadata.totalMessages.toLocaleString() : '24,821';
  const durationDays = analysis ? analysis.metadata.durationDays : 580;
  const peakHour = analysis?.activity.peakHour?.label || '11 PM';
  const topYapper = analysis?.activity.mostActiveParticipant || 'Top Contributor';
  const topEmoji = analysis?.emojis.mostUsedEmoji || '💀';
  const silenceDays = analysis?.streaks.longestSilence?.durationDays || 19;

  const slides = [
    {
      number: totalMsgs,
      unit: 'MESSAGES EXCHANGED',
      text: 'Enough text volume to populate a medium-sized court exhibit.',
      badge: 'VOLUME',
    },
    {
      number: `${durationDays}`,
      unit: 'DAYS OF CONTINUOUS LORE',
      text: 'Across all seasons, weather conditions, and questionable choices.',
      badge: 'TIMELINE',
    },
    {
      number: peakHour,
      unit: 'PEAK CHAT HOUR',
      text: 'Sleep was officially designated as optional during this window.',
      badge: 'HABITS',
    },
    {
      number: topYapper,
      unit: 'MAIN CHARACTER',
      text: 'Dominated total message volume and conversation initiation rate.',
      badge: 'TOP YAPPER',
    },
    {
      number: `${silenceDays} DAYS`,
      unit: 'LONGEST SILENCE GAP',
      text: 'Everyone was "busy" until one random message restarted the machine.',
      badge: 'THE GHOST ERA',
    },
    {
      number: topEmoji,
      unit: 'TOP EMOJI REACTION',
      text: `Used ${analysis?.emojis.mostUsedCount || 427} times as a reliable witness to nonsense.`,
      badge: 'REACTION',
    },
  ];

  const current = slides[slideIdx];

  const nextSlide = () => setSlideIdx((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setSlideIdx((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <section id="sec-wrapped" className="report-wrapped-section">
      <div className="wrapped-header">
        <span className="wrapped-eyebrow">09 · AFTERCHAT WRAPPED</span>
        <h2>Your chat in motion.</h2>
      </div>

      <div className="wrapped-card-viewport">
        <AnimatePresence mode="wait">
          <motion.div
            key={slideIdx}
            className="wrapped-slide-card"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.3 }}
          >
            <span className="wrapped-slide-badge">{current.badge}</span>
            <b className="wrapped-slide-big-num">{current.number}</b>
            <span className="wrapped-slide-unit">{current.unit}</span>
            <p className="wrapped-slide-desc">{current.text}</p>
          </motion.div>
        </AnimatePresence>

        <div className="wrapped-controls">
          <button type="button" onClick={prevSlide} className="wrapped-arrow-btn">
            ←
          </button>
          <span className="wrapped-pagination">
            {slideIdx + 1} / {slides.length}
          </span>
          <button type="button" onClick={nextSlide} className="wrapped-arrow-btn">
            →
          </button>
        </div>
      </div>
    </section>
  );
}
