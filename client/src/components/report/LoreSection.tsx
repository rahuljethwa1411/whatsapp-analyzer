/**
 * LoreSection Component
 * Inside jokes, running references, and absurd moments as scrapbook-style cards.
 */

import { FadeReveal } from '../afterchat/FadeReveal';
import { Receipt } from './Receipt';
import { LoreItem } from '../../types/intelligence';
import { ChatMessage } from '../../types/chat';

interface LoreSectionProps {
  lore: LoreItem[];
  getMessagesByIds: (ids: string[]) => ChatMessage[];
  isUnlocked: boolean;
}

export function LoreSection({ lore, getMessagesByIds, isUnlocked }: LoreSectionProps) {
  if (!lore || lore.length === 0) return null;

  const displayLore = isUnlocked ? lore : lore.slice(0, 1);

  return (
    <section id="sec-lore" className="report-lore-section">
      <FadeReveal>
        <p className="eyebrow">07 · RECOVERED LORE</p>
        <h2>Inside jokes have lore too.</h2>
        <p className="lede">The recurring memes and absurdities hiding in plain sight.</p>
      </FadeReveal>

      <div className="lore-scrapbook-grid">
        {displayLore.map((item) => (
          <FadeReveal key={item.id}>
            <div className="lore-card">
              <div className="lore-card-header">
                <span className="lore-tag">RECURRING LORE</span>
                <span className="lore-funny-badge">FUNNY SCORE: {Math.round(item.funnyScore * 10)}/10</span>
              </div>

              <h3 className="lore-card-title">{item.title}</h3>
              <p className="lore-card-description">{item.description}</p>

              <div className="lore-card-footer">
                <small>Participants: {item.participants.join(', ') || 'Everyone'}</small>
              </div>

              {item.evidenceMessageIds.length > 0 && (
                <Receipt
                  messageIds={item.evidenceMessageIds}
                  getMessagesByIds={getMessagesByIds}
                  label="Lore Receipts"
                  explanation={`Original messages for "${item.title}"`}
                />
              )}
            </div>
          </FadeReveal>
        ))}

        {!isUnlocked && lore.length > 1 && (
          <div className="lore-locked-notice">
            <p>+{lore.length - 1} more lore items unlocked in full archive.</p>
          </div>
        )}
      </div>
    </section>
  );
}
