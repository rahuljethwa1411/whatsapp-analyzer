/**
 * FinalVerdict Component
 * Satirical personalized concluding verdict for the report.
 */

import { FadeReveal } from '../afterchat/FadeReveal';
import { StoryVerdict } from '../../types/story';

interface FinalVerdictProps {
  verdict: StoryVerdict | null;
  overallTone: string;
  totalMessagesStr: string;
  durationDays: number;
}

export function FinalVerdict({
  verdict,
  overallTone,
  totalMessagesStr,
  durationDays,
}: FinalVerdictProps) {
  const verdictTitle = verdict?.title || 'ABSOLUTELY COOKED';
  const verdictBadge = verdict?.badge || 'VERIFIED CHAOS';
  const verdictDesc =
    verdict?.description ||
    'After investigating 14 months of evidence, multiple unfulfilled travel plans, and an unnecessary amount of late-night banter, our conclusion is unanimous.';

  return (
    <section id="sec-verdict" className="report-verdict-section">
      <FadeReveal>
        <p className="eyebrow">10 · THE FINAL VERDICT</p>
        <h2>So... what was this chat?</h2>

        <div className="verdict-card">
          <span className="verdict-badge">{verdictBadge}</span>
          <h1 className="verdict-headline">{verdictTitle.toUpperCase()}</h1>
          <p className="verdict-body">{verdictDesc}</p>

          <div className="verdict-summary-pills">
            <span>{totalMessagesStr} MESSAGES</span>
            <span>{durationDays} DAYS</span>
            <span>TONE: {overallTone.toUpperCase()}</span>
          </div>

          <p className="verdict-punchline">
            "You came looking for the lore. Turns out, you were the lore."
          </p>
        </div>
      </FadeReveal>
    </section>
  );
}
