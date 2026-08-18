/**
 * PlotTwistSection Component
 * Highlights major shifts in volume, topic, or behavior.
 */

import { FadeReveal } from '../afterchat/FadeReveal';
import { Receipt } from './Receipt';
import { PlotTwist } from '../../types/intelligence';
import { ChatMessage } from '../../types/chat';

import { cleanNarrative } from '../../lib/narrativeFormatter';

interface PlotTwistSectionProps {
  twists: PlotTwist[];
  getMessagesByIds: (ids: string[]) => ChatMessage[];
  isUnlocked: boolean;
}

export function PlotTwistSection({ twists, getMessagesByIds, isUnlocked }: PlotTwistSectionProps) {
  if (!twists || twists.length === 0) {
    return (
      <section id="sec-twists" className="report-twists-section">
        <FadeReveal>
          <p className="eyebrow">06 · PLOT TWISTS</p>
          <h2>Honestly? Surprisingly stable. Suspicious.</h2>
          <p className="lede">No major sudden shifts or anomalies detected in the archive timeline.</p>
        </FadeReveal>
      </section>
    );
  }

  const displayTwists = isUnlocked ? twists : twists.slice(0, 1);

  return (
    <section id="sec-twists" className="report-twists-section">
      <FadeReveal>
        <p className="eyebrow">06 · PLOT TWISTS</p>
        <h2>Something changed.</h2>
        <p className="lede">Major behavioral and volume shifts detected across periods.</p>
      </FadeReveal>

      <div className="twists-list">
        {displayTwists.map((twist, idx) => (
          <FadeReveal key={twist.id}>
            <div className="twist-card">
              <div className="twist-meta">
                <span className="twist-badge">PLOT TWIST #{String(idx + 1).padStart(2, '0')}</span>
                <span className="twist-period">
                  {cleanNarrative(twist.beforePeriod)} → {cleanNarrative(twist.afterPeriod)}
                </span>
              </div>

              <h3 className="twist-title">{cleanNarrative(twist.title)}</h3>
              <p className="twist-description">{cleanNarrative(twist.description)}</p>

              <div className="twist-significance-bar">
                <span>DRAMA IMPACT RATING</span>
                <div className="significance-track">
                  <div
                    className="significance-fill"
                    style={{ width: `${Math.round(twist.significance * 100)}%` }}
                  />
                </div>
                <b>{Math.round(twist.significance * 10)}/10</b>
              </div>

              {twist.evidenceMessageIds.length > 0 && (
                <Receipt
                  messageIds={twist.evidenceMessageIds}
                  getMessagesByIds={getMessagesByIds}
                  label="Plot Twist Receipts"
                  explanation={`Evidence supporting "${twist.title}"`}
                />
              )}
            </div>
          </FadeReveal>
        ))}

        {!isUnlocked && twists.length > 1 && (
          <div className="twists-locked-notice">
            <p>+{twists.length - 1} further plot twists unlocked in full report.</p>
          </div>
        )}
      </div>
    </section>
  );
}
