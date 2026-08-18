/**
 * CharacterSection Component
 * Displays participant archetypes grounded in factual communication statistics.
 */

import { FadeReveal } from '../afterchat/FadeReveal';
import { Receipt } from './Receipt';
import { CharacterInsight } from '../../types/intelligence';
import { ParticipantStats } from '../../types/analysis';
import { ChatMessage } from '../../types/chat';

import { cleanNarrative } from '../../lib/narrativeFormatter';

interface CharacterSectionProps {
  characters: CharacterInsight[];
  participantStats: ParticipantStats[];
  getMessagesByIds: (ids: string[]) => ChatMessage[];
  isUnlocked: boolean;
}

export function CharacterSection({
  characters,
  participantStats,
  getMessagesByIds,
  isUnlocked,
}: CharacterSectionProps) {
  if (!characters || characters.length === 0) return null;

  const displayChars = isUnlocked ? characters : characters.slice(0, 1);

  return (
    <section id="sec-characters" className="report-characters-section">
      <FadeReveal>
        <p className="eyebrow">05 · THE CAST</p>
        <h2>Characters, unexpectedly.</h2>
        <p className="lede">Grounded purely in observable chat statistics and behavior patterns.</p>
      </FadeReveal>

      <div className="characters-adaptive-grid">
        {displayChars.map((char) => {
          const stats = participantStats.find((s) => s.name === char.participant);

          return (
            <FadeReveal key={char.participant}>
              <div className="character-profile-card">
                <span className="character-archetype-tag">{cleanNarrative(char.title)}</span>
                <h3 className="character-name">{cleanNarrative(char.participant)}</h3>
                <p className="character-description">{cleanNarrative(char.description)}</p>

                {stats && (
                  <div className="character-stats-row">
                    <div className="char-stat-item">
                      <b>{stats.messageCount.toLocaleString()}</b>
                      <small>msgs ({stats.percentage.toFixed(0)}%)</small>
                    </div>
                    <div className="char-stat-item">
                      <b>{stats.avgWordsPerMessage.toFixed(1)}</b>
                      <small>words/msg</small>
                    </div>
                    <div className="char-stat-item">
                      <b>{stats.emojiCount}</b>
                      <small>emojis</small>
                    </div>
                  </div>
                )}

                {char.observableTraits.length > 0 && (
                  <ul className="character-traits-list">
                    {char.observableTraits.map((t) => (
                      <li key={t}>• {t}</li>
                    ))}
                  </ul>
                )}

                {char.evidenceMessageIds.length > 0 && (
                  <Receipt
                    messageIds={char.evidenceMessageIds}
                    getMessagesByIds={getMessagesByIds}
                    label="Character Receipts"
                    explanation={`Evidence supporting ${char.participant}'s archetype`}
                  />
                )}
              </div>
            </FadeReveal>
          );
        })}

        {!isUnlocked && characters.length > 1 && (
          <div className="characters-locked-notice">
            <p>+{characters.length - 1} more character profiles in full archive.</p>
          </div>
        )}
      </div>
    </section>
  );
}
