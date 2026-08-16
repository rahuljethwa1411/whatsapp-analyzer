/**
 * AwardsSection Component
 * Displays fun awards generated from factual stats and Phase 3/4 intelligence.
 */

import { FadeReveal } from '../afterchat/FadeReveal';
import { Receipt } from './Receipt';
import { Award } from '../../types/story';
import { ChatMessage } from '../../types/chat';

interface AwardsSectionProps {
  awards: Award[];
  getMessagesByIds: (ids: string[]) => ChatMessage[];
  isUnlocked: boolean;
}

export function AwardsSection({ awards, getMessagesByIds, isUnlocked }: AwardsSectionProps) {
  if (!awards || awards.length === 0) return null;

  const displayAwards = isUnlocked ? awards : awards.slice(0, 2);

  return (
    <section id="sec-awards" className="report-awards-section">
      <FadeReveal>
        <p className="eyebrow">08 · UNOFFICIAL YET ACCURATE</p>
        <h2>The awards ceremony.</h2>
        <p className="lede">Strictly grounded in factual chat data and observed behaviors.</p>
      </FadeReveal>

      <div className="awards-grid">
        {displayAwards.map((award) => (
          <FadeReveal key={award.id}>
            <div className="award-card">
              <div className="award-emoji">{award.emoji || '🏆'}</div>
              <h3 className="award-title">{award.title}</h3>
              <div className="award-recipient">AWARDED TO: <b>{award.recipient}</b></div>
              <p className="award-reason">{award.reason}</p>

              {award.evidenceMessageIds.length > 0 && (
                <Receipt
                  messageIds={award.evidenceMessageIds}
                  getMessagesByIds={getMessagesByIds}
                  label="Award Receipts"
                  explanation={`Evidence for ${award.recipient}'s award`}
                />
              )}
            </div>
          </FadeReveal>
        ))}

        {!isUnlocked && awards.length > 2 && (
          <div className="awards-locked-notice">
            <p>+{awards.length - 2} further awards unlocked in full report.</p>
          </div>
        )}
      </div>
    </section>
  );
}
