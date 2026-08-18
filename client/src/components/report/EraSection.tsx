/**
 * EraSection Component
 * Chronological conversation eras with dates, dominant topics, and evidence receipts.
 */

import { FadeReveal } from '../afterchat/FadeReveal';
import { Receipt } from './Receipt';
import { StoryEra } from '../../types/intelligence';
import { ChatMessage } from '../../types/chat';
import { APP_CONFIG } from '../../config/appConfig';

interface EraSectionProps {
  eras: StoryEra[];
  getMessagesByIds: (ids: string[]) => ChatMessage[];
  isUnlocked: boolean;
  onUnlock?: () => void;
}

export function EraSection({ eras, getMessagesByIds, isUnlocked, onUnlock }: EraSectionProps) {
  if (!eras || eras.length === 0) return null;

  const displayEras = isUnlocked ? eras : eras.slice(0, 2);

  return (
    <section id="sec-eras" className="report-eras-section">
      <FadeReveal>
        <p className="eyebrow">04 · STORY ERAS</p>
        <h2>Every chat has eras.</h2>
        <p className="lede">Identified through activity shifts, topic changes, and key events.</p>
      </FadeReveal>

      <div className="eras-list">
        {displayEras.map((era, index) => (
          <FadeReveal key={era.id}>
            <div className="era-card">
              <div className="era-header-row">
                <span className="era-number">ERA {String(index + 1).padStart(2, '0')}</span>
                <span className="era-dates">
                  {formatDate(era.startAt)} → {formatDate(era.endAt)}
                </span>
              </div>
              <h3 className="era-title">{era.title}</h3>
              <p className="era-summary">{era.summary}</p>

              {era.dominantTopics.length > 0 && (
                <div className="era-topics">
                  <b>DOMINANT TOPICS:</b> {era.dominantTopics.join(', ')}
                </div>
              )}

              {era.evidenceMessageIds.length > 0 && (
                <Receipt
                  messageIds={era.evidenceMessageIds}
                  getMessagesByIds={getMessagesByIds}
                  label="Era Receipts"
                  explanation={`Evidence supporting "${era.title}"`}
                />
              )}
            </div>
          </FadeReveal>
        ))}

        {/* Cliffhanger Era 3 Teaser in Preview Mode */}
        {!isUnlocked && eras[2] && (
          <FadeReveal>
            <div className="era-card story-chapter-teaser">
              <div className="era-header-row">
                <span className="era-number">ERA 03</span>
                <span className="era-dates">
                  {formatDate(eras[2].startAt)} → {formatDate(eras[2].endAt)}
                </span>
                <span className="chapter-locked-badge">🔒 LOCKED ERA</span>
              </div>
              <h3 className="era-title">{eras[2].title}</h3>
              <div className="teaser-narrative-wrapper">
                <p className="era-summary teaser-text">
                  {eras[2].summary.slice(0, 140)}...
                </p>
                <div className="teaser-blur-overlay">
                  <div className="teaser-cta-content">
                    <span className="teaser-lock-icon">🔒</span>
                    <p className="teaser-headline">+{eras.length - 2} more relationship eras documented in full archive.</p>
                    <small>Unlock deep 100–250 word breakdowns, dominant topics & verified receipts</small>
                    <button
                      type="button"
                      className="button teaser-unlock-btn"
                      onClick={() => {
                        const gate = document.querySelector('.preview-gate-section');
                        if (gate) {
                          gate.scrollIntoView({ behavior: 'smooth' });
                        } else if (onUnlock) {
                          onUnlock();
                        }
                      }}
                    >
                      Unlock Full 6-Page Dossier (₹{APP_CONFIG.REPORT_PRICE_INR}) <span>→</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </FadeReveal>
        )}
      </div>
    </section>
  );
}

function formatDate(dStr: string): string {
  if (!dStr) return '?';
  try {
    return new Date(dStr).toLocaleDateString('en-GB', {
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return dStr;
  }
}
