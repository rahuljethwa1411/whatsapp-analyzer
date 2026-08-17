/**
 * PreviewGate Component
 * Integrated with Razorpay Standard Web Checkout.
 * Upon successful payment & signature verification, swaps accessMode to 'full'.
 */

import { useState } from 'react';
import { FadeReveal } from '../afterchat/FadeReveal';
import { openRazorpayCheckout } from '../../lib/razorpay';
import { RazorpayVerificationResponse } from '../../types/razorpay';

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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRazorpayPay = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    await openRazorpayCheckout({
      amount: 54900, // ₹549 in paise
      currency: 'INR',
      name: 'Afterchat AI',
      description: 'Unlock Full 6-Page Intelligence Dossier',
      theme: {
        color: '#cc513d',
      },
      onSuccess: (res: RazorpayVerificationResponse) => {
        setLoading(false);
        setSuccessMessage(`Payment verified! ID: ${res.payment_id}`);
        setTimeout(() => {
          onUnlock();
        }, 800);
      },
      onError: (err: any) => {
        setLoading(false);
        const msg = typeof err === 'string' ? err : err.message || 'Payment failed';
        setErrorMessage(msg);
      },
      onDismiss: () => {
        setLoading(false);
      },
    });
  };

  return (
    <section className="preview-gate-section">
      <FadeReveal>
        <div className="preview-gate-box">
          <div className="preview-gate-top-badges">
            <span className="preview-gate-badge">👑 FULL 6-PAGE INTELLIGENCE DOSSIER</span>
            <span className="preview-gate-discount-badge">🔥 SAVE 45% • LAUNCH OFFER</span>
          </div>

          <h2>You've only seen 20% of the evidence.</h2>
          <p className="preview-gate-desc">
            The full 6-page documentary archive contains all remaining unhinged chapters, 
            every savage call-hanging & clinginess receipt, inside joke origin stories, 
            and the complete satirical awards ceremony.
          </p>

          <div className="preview-value-checklist">
            <div className="preview-value-item">
              <span className="val-check">✓</span>
              <span><b>All 10 Documentary Chapters</b> (failed trips, 2 AM hostage texts & savage receipts)</span>
            </div>
            <div className="preview-value-item">
              <span className="val-check">✓</span>
              <span><b>All Story Eras</b> (with rich 100–250 word witty breakdowns & dominant topics)</span>
            </div>
            <div className="preview-value-item">
              <span className="val-check">✓</span>
              <span><b>The Full Cast Dossier</b> (Self-image claims vs observable reality & habits)</span>
            </div>
            <div className="preview-value-item">
              <span className="val-check">✓</span>
              <span><b>Recovered Lore & Inside Jokes</b> (origin myths, tapri lore & recurring catchphrases)</span>
            </div>
            <div className="preview-value-item">
              <span className="val-check">✓</span>
              <span><b>Satirical Awards Ceremony</b> (Custom roasts & titles for all participants)</span>
            </div>
            <div className="preview-value-item">
              <span className="val-check">✓</span>
              <span><b>Final Relationship Verdict & Shareable Instagram Badge</b></span>
            </div>
          </div>

          {unlockedCount && (
            <div className="preview-gate-counts">
              <span>{unlockedCount.eras} MORE ERAS</span> • <span>{unlockedCount.characters} CHARACTERS</span> •{' '}
              <span>{unlockedCount.lore} LORE ORIGINS</span> • <span>{unlockedCount.twists} PLOT TWISTS</span>
            </div>
          )}

          <div className="preview-gate-price-row">
            <div className="price-stack">
              <span className="original-price">₹999</span>
              <b className="preview-gate-price">₹549</b>
            </div>
            <small>One-time payment • Lifetime access • Instant unlock</small>
          </div>

          {errorMessage && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #fca5a5',
                color: '#dc2626',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '6px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid #86efac',
                color: '#16a34a',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              ✓ {successMessage}
            </div>
          )}

          <button
            type="button"
            className="button preview-gate-btn"
            onClick={handleRazorpayPay}
            disabled={loading}
            style={{
              opacity: loading ? 0.75 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            {loading ? (
              <span>Opening Razorpay Secure Checkout...</span>
            ) : (
              <>
                <span>Pay with Razorpay to Unlock Full Dossier (₹549)</span>
                <span>💳 →</span>
              </>
            )}
          </button>
          
          <div className="preview-gate-trust-row">
            <span>🔒 Razorpay 256-bit SSL</span>
            <span>⚡ Supports UPI, Cards, NetBanking</span>
            <span>📱 1-Click WhatsApp & Instagram Share</span>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={onUnlock}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                opacity: 0.6,
                fontSize: '12px',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Free Demo Mode / Bypass for testing →
            </button>
          </div>
        </div>
      </FadeReveal>
    </section>
  );
}
