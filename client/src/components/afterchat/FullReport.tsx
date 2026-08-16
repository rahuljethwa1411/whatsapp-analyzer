/**
 * FullReport
 * The "unlocked" section of the report.
 * Uses real AfterchatIntelligence when available, falls back to mock data.
 */

import { motion } from 'framer-motion';
import { chapters, people, jokes } from '../../data/mockAfterChat';
import { FadeReveal } from './FadeReveal';
import { EvidenceDrawer } from './EvidenceDrawer';
import type { AfterchatIntelligence, PatternInsight } from '../../types/intelligence';
import type { ChatMessage } from '../../types/chat';

interface FullReportProps {
  intelligence: AfterchatIntelligence | null;
  patterns: PatternInsight[];
  getMessagesByIds: (ids: string[]) => ChatMessage[];
}

export function FullReport({ intelligence, patterns, getMessagesByIds }: FullReportProps) {
  const hasIntelligence = !!intelligence;

  // Characters: real AI archetypes or mock
  const characters = hasIntelligence && intelligence.characters.length > 0
    ? intelligence.characters
    : null;

  // Lore: real AI lore or mock jokes
  const loreItems = hasIntelligence && intelligence.lore.length > 0
    ? intelligence.lore
    : null;

  // Patterns: real AI patterns
  const patternItems = patterns.length > 0 ? patterns : null;

  return (
    <div className="full">
      {/* The Complete Story Chapters (Phase 4 will replace this) */}
      <section className="report-section">
        <FadeReveal>
          <p className="eyebrow">THE COMPLETE STORY</p>
          <h2>It started innocently.</h2>
          {chapters.map((chapter) => (
            <article className="chapter" key={chapter.title}>
              <span>{chapter.title}</span>
              {chapter.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
        </FadeReveal>
      </section>

      {/* The Cast — real AI character archetypes */}
      <section className="report-section">
        <FadeReveal>
          <p className="eyebrow">THE CAST</p>
          <h2>Characters, unfortunately.</h2>
        </FadeReveal>
        <div className="characters">
          {characters ? (
            characters.map((char) => (
              <FadeReveal key={char.participant}>
                <span>{char.title}</span>
                <h3>{char.participant}</h3>
                <p>{char.description}</p>
                {char.observableTraits.length > 0 && (
                  <b>{char.observableTraits.slice(0, 2).join(' · ')}</b>
                )}
                {char.evidenceMessageIds.length > 0 && (
                  <EvidenceDrawer
                    messageIds={char.evidenceMessageIds}
                    getMessagesByIds={getMessagesByIds}
                    label="View evidence"
                  />
                )}
              </FadeReveal>
            ))
          ) : (
            people.map((person) => (
              <FadeReveal key={person.name}>
                <span>{person.role}</span>
                <h3>{person.name}</h3>
                <p>{person.description}</p>
                <b>{person.stat}</b>
              </FadeReveal>
            ))
          )}
        </div>
      </section>

      {/* The Recurring Bits — real AI lore */}
      <section className="report-section">
        <FadeReveal>
          <p className="eyebrow">THE RECURRING BITS</p>
          <h2>Inside jokes have lore too.</h2>
          {loreItems ? (
            loreItems.map((item) => (
              <article className="joke" key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <b>Funny score: {Math.round(item.funnyScore * 10)}/10</b>
                <small>Participants: {item.participants.join(', ')}</small>
                {item.evidenceMessageIds.length > 0 && (
                  <EvidenceDrawer
                    messageIds={item.evidenceMessageIds}
                    getMessagesByIds={getMessagesByIds}
                    label="See receipts"
                  />
                )}
              </article>
            ))
          ) : (
            jokes.map((joke) => (
              <article className="joke" key={joke.name}>
                <h3>{joke.name}</h3>
                <p>{joke.description}</p>
                <b>{joke.count} appearances</b>
                <small>First spotted: {joke.first}</small>
              </article>
            ))
          )}
        </FadeReveal>
      </section>

      {/* Patterns — AI only */}
      {patternItems && (
        <section className="report-section">
          <FadeReveal>
            <p className="eyebrow">THE PATTERNS</p>
            <h2>Things that kept happening.</h2>
            {patternItems.map((pattern) => (
              <article className="joke" key={pattern.id}>
                <h3>{pattern.title}</h3>
                <p>{pattern.description}</p>
                <b>Happened ~{pattern.frequency}× · Importance: {Math.round(pattern.importance * 10)}/10</b>
                {pattern.evidenceMessageIds.length > 0 && (
                  <EvidenceDrawer
                    messageIds={pattern.evidenceMessageIds}
                    getMessagesByIds={getMessagesByIds}
                    label="See receipts"
                  />
                )}
              </article>
            ))}
          </FadeReveal>
        </section>
      )}

      {/* Awards */}
      <section className="report-section awards">
        <FadeReveal>
          <p className="eyebrow">UNOFFICIAL, YET ACCURATE</p>
          <h2>The awards.</h2>
          <div>
            {(hasIntelligence && characters
              ? characters.map((c) => `🏆 ${c.title.replace('The ', '')} — ${c.participant}`)
              : [
                  '🏆 Professional Yapper',
                  '👻 The Ghost',
                  '🔥 The Instigator',
                  '😂 Comedian',
                  '🧘 Therapist',
                  '👑 Main Character',
                ]
            ).map((award) => (
              <motion.span whileHover={{ rotate: -2, scale: 1.03 }} key={award}>
                {award}
              </motion.span>
            ))}
          </div>
        </FadeReveal>
      </section>

      {/* End Credits */}
      <section className="ending">
        <FadeReveal>
          <p className="eyebrow">END CREDITS</p>
          <h2>So this was your chat.</h2>
          <p>
            The lore, however, is fully paid up.
          </p>
          <p>
            {hasIntelligence
              ? `${intelligence!.eras.length} eras. ${intelligence!.characters.length} characters. ${intelligence!.lore.length} lore items. More than you remembered.`
              : 'Goa still isn\'t happening.'}
          </p>
          <a className="button" href="/">
            Start another story <span>→</span>
          </a>
        </FadeReveal>
      </section>
    </div>
  );
}
