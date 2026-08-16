/**
 * PreviewGate Component
 * Product architecture gate for future monetization paywall.
 * Swaps reportAccess mode from 'preview' to 'full' (mocked unlock).
 */

import { FadeReveal } from '../afterchat/FadeReveal';

interface PreviewGateProps {
  onUnlock: () => void;
  unlockedCount?: {
    eras: number;
    lore: number;
    characters: number;
    twists: number;
  };
}

export function PreviewGate({ onUnlock, unlockedCount }: PreviewGateProps) {
  return (
    <section className="preview-gate-section">
      <FadeReveal>
        <div className="preview-gate-box">
          <span className="preview-gate-badge">DOCUMENTARY ARCHIVE ACCESS</span>
          <h2>There's considerably more evidence.</h2>
          <p className="preview-gate-desc">
            You've unlocked the preview. The full archive contains complete chronological story
            chapters, all character archetypes, full lore items, verified receipts, and the complete
            awards ceremony.
          </p>

          {unlockedCount && (
            <div className="preview-gate-counts">
              <span>{unlockedCount.eras} ERAS</span> • <span>{unlockedCount.characters} CHARACTERS</span> •{' '}
              <span>{unlockedCount.lore} LORE ITEMS</span> • <span>{unlockedCount.twists} PLOT TWISTS</span>
            </div>
          )}

          <div className="preview-gate-price-row">
            <b className="preview-gate-price">₹249</b>
            <small>One-time access • Unlimited viewing</small>
          </div>

          <button type="button" className="button preview-gate-btn" onClick={onUnlock}>
            Unlock Full AfterChat <span>→</span>
          </button>
          <p className="preview-gate-demo-note">Demo Mode — Click to instantly unlock full report.</p>
        </div>
      </FadeReveal>
    </section>
  );
}
