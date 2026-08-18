import { ReactNode } from 'react';
import { FadeReveal } from '../afterchat/FadeReveal';
import { Receipt } from './Receipt';
import { Story } from '../../types/story';
import { ChatMessage } from '../../types/chat';
import { APP_CONFIG } from '../../config/appConfig';

interface StorySectionProps {
  story: Story | null;
  isLoading?: boolean;
  getMessagesByIds: (ids: string[]) => ChatMessage[];
  isUnlocked: boolean;
  onUnlock?: () => void;
}

export function StorySection({
  story,
  isLoading = false,
  getMessagesByIds,
  isUnlocked,
  onUnlock,
}: StorySectionProps) {
  if (isLoading || !story) {
    return (
      <section id="sec-story" className="report-story-section">
        <FadeReveal>
          <p className="eyebrow">03 · THE COMPLETE STORY</p>
          <div
            className="story-generating-box"
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'rgba(204, 81, 61, 0.04)',
              border: '1px dashed rgba(204, 81, 61, 0.3)',
              borderRadius: '12px',
              margin: '24px 0',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                width: '36px',
                height: '36px',
                border: '3px solid rgba(204, 81, 61, 0.2)',
                borderTopColor: '#cc513d',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: '16px',
              }}
            />
            <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '22px', color: '#e8e0d2', marginBottom: '8px' }}>
              Writing 10-Chapter Documentary with gpt-5-mini...
            </h3>
            <p style={{ color: '#9e948a', fontSize: '13.5px', maxWidth: '480px', margin: '0 auto', lineHeight: '1.6' }}>
              Cross-referencing verified receipts, unhinged quotes, and relationship timeline before revealing the full narrative.
            </p>
          </div>
        </FadeReveal>
      </section>
    );
  }

  // Preview mode shows first 2 chapters
  const displayChapters = isUnlocked ? story.chapters : story.chapters.slice(0, 2);

  return (
    <section id="sec-story" className="report-story-section">
      <FadeReveal>
        <p className="eyebrow">03 · THE COMPLETE STORY</p>
        <h2>{story.title}</h2>
        <p className="lede">{story.subtitle}</p>

        <div className="story-opening-box">
          {story.opening.split(/\n\n+/).map((para, pIdx) => {
            const trimmed = para.trim();
            if (!trimmed) return null;

            // Detect signature AfterChat card sections
            const lower = trimmed.toLowerCase();
            const isOperatingMetaphor = lower.includes('core operating metaphor') ||
              lower.includes('relationship architecture') ||
              lower.includes('structurally resembles') ||
              lower.includes('home turf') ||
              lower.includes('mutual adversaries');
            const isPersonaVsRecord = lower.includes('projected persona') ||
              lower.includes('incriminating record') ||
              lower.includes('self-mythology') ||
              lower.includes('roles you think you play');

            return (
              <div
                key={pIdx}
                className={`story-opening-paragraph ${isOperatingMetaphor ? 'structural-metaphor-card' : ''} ${isPersonaVsRecord ? 'roles-contrast-card' : ''}`}
              >
                {renderHighlightedNarrative(trimmed, getMessagesByIds)}
              </div>
            );
          })}
        </div>
      </FadeReveal>

      <div className="story-chapters-container">
        {displayChapters.map((chapter, idx) => (
          <FadeReveal key={chapter.id}>
            <article className="story-chapter-card">
              <div className="chapter-meta">
                <span className="chapter-num">CHAPTER {String(idx + 1).padStart(2, '0')}</span>
                <span className="chapter-period">{chapter.period}</span>
              </div>
              <h3 className="chapter-title">{chapter.title}</h3>
              <div className="chapter-narrative">
                {chapter.narrative.split(/\n\n+/).map((para, pIdx) => (
                  <p key={pIdx} className="chapter-paragraph">
                    {renderHighlightedNarrative(para.trim(), getMessagesByIds)}
                  </p>
                ))}
              </div>

              {chapter.keyStats.filter(st => st?.label && st?.value && !String(st.value).includes('ev_int') && !String(st.label).toLowerCase().includes('evidence')).length > 0 && (
                <div className="chapter-stats-row">
                  {chapter.keyStats
                    .filter(st => st?.label && st?.value && !String(st.value).includes('ev_int') && !String(st.label).toLowerCase().includes('evidence'))
                    .map((st) => (
                      <span key={st.label} className="chapter-stat-pill">
                        <b>{st.value}</b> {st.label}
                      </span>
                    ))}
                </div>
              )}

              {chapter.evidenceMessageIds.length > 0 && (
                <Receipt
                  messageIds={chapter.evidenceMessageIds}
                  getMessagesByIds={getMessagesByIds}
                  label="View Chapter Receipts"
                  explanation={`Evidence supporting Chapter ${idx + 1}`}
                />
              )}
            </article>
          </FadeReveal>
        ))}

        {/* Cliffhanger Chapter 3 Teaser in Preview Mode */}
        {!isUnlocked && story.chapters[2] && (
          <FadeReveal>
            <article className="story-chapter-card story-chapter-teaser">
              <div className="chapter-meta">
                <span className="chapter-num">CHAPTER 03</span>
                <span className="chapter-period">{story.chapters[2].period}</span>
                <span className="chapter-locked-badge">🔒 LOCKED TEASER</span>
              </div>
              <h3 className="chapter-title">{story.chapters[2].title}</h3>
              <div className="teaser-narrative-wrapper">
                <div className="chapter-narrative teaser-text">
                  {renderHighlightedNarrative(story.chapters[2].narrative.slice(0, 180) + '...', getMessagesByIds)}
                </div>
                <div className="teaser-blur-overlay">
                  <div className="teaser-cta-content">
                    <span className="teaser-lock-icon">🔒</span>
                    <p className="teaser-headline">The story gets considerably more unhinged here.</p>
                    <small>+{story.chapters.length - 2} full chapters (250 words each), all savage receipts & callbacks locked</small>
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
            </article>
          </FadeReveal>
        )}
      </div>
    </section>
  );
}

/**
 * Parses and highlights real WhatsApp quotes, messages, and receipts inside story prose.
 */
function renderHighlightedNarrative(
  text: string,
  getMessagesByIds: (ids: string[]) => ChatMessage[]
): ReactNode {
  if (!text) return null;

  // 1. First resolve msg_123 IDs to encoded tokens
  const ids = [...new Set(text.match(/\bmsg_\d+\b/g) || [])];
  let processed = text;

  if (ids.length > 0) {
    const messages = new Map(getMessagesByIds(ids).map((msg) => [msg.id, msg]));
    processed = processed.replace(/\bmsg_\d+\b/g, (id) => {
      const msg = messages.get(id);
      if (!msg?.text) return id;
      const preview = msg.text.length > 140 ? `${msg.text.slice(0, 137)}...` : msg.text;
      return `«MSG::${msg.sender || 'Participant'}::${preview}»`;
    });
  }

  // 2. Tokenize by encoded receipts and real double-quoted dialogue ("..." or “...”)
  // NEVER split on single quotes (') because that breaks English contractions (it's, don't, Rahul's).
  const tokens = processed.split(/(«MSG::[^»]+»|"[^"\n]{2,160}"|“[^”\n]{2,160}”)/g);

  return (
    <>
      {tokens.map((token, i) => {
        if (!token) return null;

        // Formatted Msg Receipt
        if (token.startsWith('«MSG::') && token.endsWith('»')) {
          const parts = token.slice(6, -1).split('::');
          const sender = parts[0] || 'Unknown';
          const msgText = parts.slice(1).join('::');
          return (
            <mark key={i} className="story-message-highlight verified-receipt-pill">
              <span className="msg-tag">RECEIPT</span>
              <b className="msg-sender">{sender}:</b>
              <span className="msg-body">"{msgText}"</span>
            </mark>
          );
        }

        // Quoted message text inside double quotes ("..." or “...”)
        if (
          (token.startsWith('"') && token.endsWith('"') && token.length > 2) ||
          (token.startsWith('“') && token.endsWith('”') && token.length > 2)
        ) {
          const innerQuote = token.slice(1, -1);
          return (
            <mark key={i} className="story-message-highlight inline-chat-quote">
              <span className="msg-quote-symbol">“</span>
              <span className="msg-quote-body">{innerQuote}</span>
              <span className="msg-quote-symbol">”</span>
            </mark>
          );
        }

        return <span key={i}>{token}</span>;
      })}
    </>
  );
}
