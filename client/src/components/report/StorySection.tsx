import { ReactNode } from 'react';
import { FadeReveal } from '../afterchat/FadeReveal';
import { Receipt } from './Receipt';
import { Story } from '../../types/story';
import { ChatMessage } from '../../types/chat';

interface StorySectionProps {
  story: Story | null;
  getMessagesByIds: (ids: string[]) => ChatMessage[];
  isUnlocked: boolean;
  onUnlock?: () => void;
}

export function StorySection({
  story,
  getMessagesByIds,
  isUnlocked,
  onUnlock,
}: StorySectionProps) {
  if (!story) {
    return (
      <section id="sec-story" className="report-story-section">
        <FadeReveal>
          <p className="eyebrow">03 · THE COMPLETE STORY</p>
          <h2>The narrative is generating...</h2>
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
          <p className="story-opening-text">
            {renderHighlightedNarrative(story.opening, getMessagesByIds)}
          </p>
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
                {renderHighlightedNarrative(chapter.narrative, getMessagesByIds)}
              </div>

              {chapter.keyStats.length > 0 && (
                <div className="chapter-stats-row">
                  {chapter.keyStats.map((st) => (
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
                    {onUnlock && (
                      <button type="button" className="button teaser-unlock-btn" onClick={onUnlock}>
                        Unlock Full 6-Page Dossier (₹549) <span>→</span>
                      </button>
                    )}
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

  // 2. Tokenize by encoded receipts and quotes ('...' or "...")
  const tokens = processed.split(/(«MSG::[^»]+»|'[^'\n]{2,160}'|"[^"\n]{2,160}")/g);

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

        // Quoted message text inside single or double quotes
        if (
          (token.startsWith("'") && token.endsWith("'") && token.length > 3) ||
          (token.startsWith('"') && token.endsWith('"') && token.length > 3)
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
