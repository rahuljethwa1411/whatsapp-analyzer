/**
 * ReportHero Component
 * Dramatic cinematic opening section for AfterChat report.
 */

import { FadeReveal } from '../afterchat/FadeReveal';

interface ReportHeroProps {
  participantsStr: string;
  totalMessagesStr: string;
  durationDays: number;
  onShare: () => void;
  onUnlock?: () => void;
  onDownloadPdf?: () => void;
  isUnlocked: boolean;
}

export function ReportHero({
  participantsStr,
  totalMessagesStr,
  durationDays,
  onShare,
  onUnlock,
  onDownloadPdf,
  isUnlocked,
}: ReportHeroProps) {
  return (
    <section id="sec-opening" className="report-hero-section">
      <FadeReveal>
        <div className="hero-top-meta">
          <span className="hero-meta-badge">AFTERCHAT DOCUMENTARY ARCHIVE</span>
          <span className="hero-participants">{participantsStr.toUpperCase()}</span>
        </div>

        <h1 className="hero-headline">
          Your chat has been
          <br />
          <em>investigated.</em>
        </h1>

        <p className="hero-subheadline">
          We regret to inform you that there is extensive, undeniable evidence.
        </p>

        <div className="hero-mega-stats-row">
          <div className="hero-stat-block">
            <b>{totalMessagesStr}</b>
            <small>MESSAGES</small>
          </div>
          <div className="hero-stat-block">
            <b>{durationDays}</b>
            <small>DAYS OF LORE</small>
          </div>
          <div className="hero-stat-block">
            <b>100%</b>
            <small>RECEIPTS VERIFIED</small>
          </div>
        </div>

        <div className="hero-action-row">
          {!isUnlocked && onUnlock && (
            <button type="button" className="button hero-unlock-btn" onClick={onUnlock}>
              Unlock Full 6-Page Dossier (₹549) 🔓
            </button>
          )}
          {isUnlocked && onDownloadPdf && (
            <button type="button" className="button hero-download-pdf-btn" onClick={onDownloadPdf}>
              📥 Download 6-Page Case File (PDF)
            </button>
          )}
          <button type="button" className="text-button hero-share-btn" onClick={onShare}>
            Share Receipt ↗
          </button>
        </div>
      </FadeReveal>
    </section>
  );
}
