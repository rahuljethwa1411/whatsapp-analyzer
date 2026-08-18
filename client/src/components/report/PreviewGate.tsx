/**
 * PreviewGate Component
 * High-Converting, Interactive Dossier Paywall with Razorpay Web Checkout.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeReveal } from '../afterchat/FadeReveal';
import { openRazorpayCheckout } from '../../lib/razorpay';
import { RazorpayVerificationResponse } from '../../types/razorpay';
import { APP_CONFIG } from '../../config/appConfig';

interface PreviewGateProps {
  onUnlock: () => void;
  unlockedCount?: {
    eras: number;
    lore: number;
    characters: number;
    twists: number;
  };
}

const PREVIEW_TABS = [
  {
    id: 'chapters',
    icon: '📖',
    label: '8 Hidden Chapters',
    title: 'The Uncensored Narrative (Chapters 03–10)',
    desc: 'Full 250-word investigative breakdowns covering 2 AM text hostage situations, ghosting patterns, trip cancellation forensics, and savage timestamps.',
    badge: 'UNEDITED TRANSCRIPTS',
  },
  {
    id: 'characters',
    icon: '🎭',
    label: 'Cast Dossier',
    title: 'Psychological Profiles & Hypocrisy Indexes',
    desc: 'Self-image vs observable reality, sleep schedule breakdowns, response latency extremes, and communication habits.',
    badge: 'BEHAVIORAL FORENSICS',
  },
  {
    id: 'lore',
    icon: '📜',
    label: 'Inside Lore',
    title: 'Origin Stories & Inside Joke Myths',
    desc: 'First recorded occurrences of recurring phrases, tapri moments, unhinged slang origins, and inside joke timelines.',
    badge: 'ARCHIVE ORIGINS',
  },
  {
    id: 'awards',
    icon: '🏆',
    label: 'Savage Roasts',
    title: 'The Annual Satirical Awards Ceremony',
    desc: 'Custom roasts, custom-earned medals, "Most Likely to Leave on Read", and the Final Relationship Verdict with shareable Instagram card.',
    badge: 'CUSTOM ROASTS',
  },
  {
    id: 'pdf',
    icon: '📄',
    label: 'Classified PDF',
    title: 'Instant 6-Page Exportable PDF Dossier',
    desc: 'High-resolution editorial intelligence report formatted like a classified agency case file. Ready for print or sharing.',
    badge: 'INSTANT DOWNLOAD',
  },
];

const PAYMENT_METHODS = [
  { name: 'Google Pay', icon: '🟢 GPay' },
  { name: 'PhonePe', icon: '🟣 PhonePe' },
  { name: 'Paytm / CRED', icon: '🔵 Paytm' },
  { name: 'Any UPI App', icon: '⚡ UPI' },
  { name: 'Cards', icon: '💳 Visa/Mastercard/RuPay' },
  { name: 'NetBanking', icon: '🏦 50+ Banks' },
];

export function PreviewGate({ onUnlock, unlockedCount }: PreviewGateProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('afterchat_user_email') || '';
    } catch {
      return '';
    }
  });
  const [emailError, setEmailError] = useState<string | null>(null);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleRazorpayPay = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address so we can email your report & receipt.');
      return;
    }

    try {
      localStorage.setItem('afterchat_user_email', trimmedEmail);
    } catch { /* ignore */ }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailError(null);

    await openRazorpayCheckout({
      amount: APP_CONFIG.REPORT_PRICE_PAISE,
      currency: 'INR',
      name: 'Afterchat AI',
      description: 'Unlock Full 6-Page Intelligence Dossier',
      prefill: {
        email: trimmedEmail,
      },
      notes: {
        email: trimmedEmail,
      },
      theme: {
        color: '#cc513d',
      },
      onSuccess: (res: RazorpayVerificationResponse) => {
        setLoading(false);
        setSuccessMessage(`Payment verified! Full report unlocked & receipt dispatched to ${trimmedEmail}`);
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

  const activeContent = PREVIEW_TABS[activeTab];

  return (
    <section className="preview-gate-section" id="paywall-gate">
      <FadeReveal>
        <div className="preview-gate-card">
          {/* Header Banner */}
          <div className="preview-gate-header">
            <div className="preview-gate-badge-row">
              <span className="gate-pill-badge vip-pill">🔒 CLASSIFIED DOSSIER</span>
              <span className="gate-pill-badge discount-pill">🔥 50% OFF • LAUNCH OFFER</span>
            </div>
            <h2 className="preview-gate-headline">
              You've Unlocked 20% of the Story.
            </h2>
            <p className="preview-gate-subtext">
              The remaining 80% contains the unhinged late-night receipts, full era timelines, 
              psychological cast files, inside joke origins, and the satirical roast ceremony.
            </p>
          </div>

          {/* Interactive Feature Tabs */}
          <div className="preview-interactive-container">
            <div className="preview-tabs-nav" role="tablist">
              {PREVIEW_TABS.map((tab, idx) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === idx}
                  className={`preview-tab-btn ${activeTab === idx ? 'active' : ''}`}
                  onClick={() => setActiveTab(idx)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-label">{tab.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeContent.id}
                className="preview-tab-display"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="tab-display-badge-row">
                  <span className="tab-dossier-pill">{activeContent.badge}</span>
                  <span className="tab-locked-indicator">🔒 Locked in Preview</span>
                </div>
                <h3 className="tab-display-title">{activeContent.title}</h3>
                <p className="tab-display-desc">{activeContent.desc}</p>
                <div className="tab-display-receipt-sample">
                  <span className="sample-label">EVIDENCE SAMPLE:</span>
                  <span className="sample-receipt">"bhai 5 min me aa raha hu" (Sent 3 hours before arrival)</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dynamic Evidence Counter */}
          {unlockedCount && (
            <div className="preview-stats-bar">
              <div className="stat-item">
                <b>+{unlockedCount.eras}</b>
                <span>Relationship Eras</span>
              </div>
              <div className="stat-item">
                <b>+{unlockedCount.characters}</b>
                <span>Psych Profiles</span>
              </div>
              <div className="stat-item">
                <b>+{unlockedCount.lore}</b>
                <span>Lore Origins</span>
              </div>
              <div className="stat-item">
                <b>+{unlockedCount.twists}</b>
                <span>Plot Twists</span>
              </div>
            </div>
          )}

          {/* Pricing & Checkout Card */}
          <div className="preview-checkout-box">
            <div className="preview-price-container">
              <div className="price-tag-wrap">
                <span className="original-price-strike">₹{APP_CONFIG.ORIGINAL_PRICE_INR}</span>
                <span className="current-price-val">₹{APP_CONFIG.REPORT_PRICE_INR}</span>
                <span className="savings-chip">50% LAUNCH OFFER</span>
              </div>
              <p className="price-guarantee-note">
                One-time unlock for this archive • Lifetime private access • Instant 6-page PDF download
              </p>
            </div>

            {/* Full Package Value Proposition */}
            <div className="preview-package-features" style={{
              background: 'rgba(204, 81, 61, 0.06)',
              border: '1px solid rgba(204, 81, 61, 0.25)',
              borderRadius: '10px',
              padding: '16px 20px',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <div style={{
                color: '#ff8a75',
                fontFamily: '"DM Mono", monospace',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
                marginBottom: '10px',
                textTransform: 'uppercase'
              }}>
                📦 WHAT'S UNLOCKED FOR ₹{APP_CONFIG.REPORT_PRICE_INR} (ONE-TIME):
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: '18px',
                color: '#e8e0d2',
                fontSize: '13px',
                lineHeight: '1.8'
              }}>
                <li><strong>10 Unhinged Documentary Chapters</strong> with verified quotes & receipts</li>
                <li><strong>Full Relationship Timeline & Era Maps</strong> with date ranges & shifts</li>
                <li><strong>Inside Joke & Lore Origins</strong> (how nicknames & running gags began)</li>
                <li><strong>The Satirical Awards Ceremony</strong> (custom roast trophies)</li>
                <li><strong>Official Relationship Verdict & Badge</strong> with shareable quote cards</li>
                <li><strong>Downloadable 6-Page Printable PDF Dossier</strong> in high-res editorial layout</li>
              </ul>
            </div>

            {/* Email Input Field */}
            <div className="preview-email-field-wrapper">
              <div className="email-label-row">
                <label htmlFor="checkout-email" className="email-input-label">
                  📧 Delivery Email Address
                </label>
                {isValidEmail(email) && (
                  <span className="email-valid-badge">✓ Verified for instant delivery</span>
                )}
              </div>
              <div className="email-input-relative">
                <input
                  id="checkout-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                  placeholder="Enter your email (e.g. rahul@gmail.com)"
                  className={`preview-email-input ${emailError ? 'input-error' : ''} ${isValidEmail(email) ? 'input-valid' : ''}`}
                />
              </div>
              {emailError ? (
                <p className="field-error-text">⚠️ {emailError}</p>
              ) : (
                <p className="field-hint-text">
                  Your full 6-page classified PDF report and payment receipt will be dispatched here.
                </p>
              )}
            </div>

            {/* Error / Success feedback */}
            {errorMessage && (
              <div className="checkout-alert-box error">
                ⚠️ {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="checkout-alert-box success">
                ✓ {successMessage}
              </div>
            )}

            {/* Main Razorpay Payment Button */}
            <button
              type="button"
              className="preview-unlock-cta-button"
              onClick={handleRazorpayPay}
              disabled={loading}
            >
              {loading ? (
                <span className="btn-inner-loading">
                  <span className="spinner-dot" /> Connecting to Razorpay Secure Gateway...
                </span>
              ) : (
                <span className="btn-inner-content">
                  <span>Pay ₹{APP_CONFIG.REPORT_PRICE_INR} to Unlock Full 6-Page Dossier</span>
                  <span className="btn-arrow-icon">💳 →</span>
                </span>
              )}
            </button>

            {/* Supported Payment Methods Badge Row */}
            <div className="payment-methods-strip">
              <span className="methods-label">Instant payment via:</span>
              <div className="methods-pill-group">
                {PAYMENT_METHODS.map((method) => (
                  <span key={method.name} className="method-pill">
                    {method.icon}
                  </span>
                ))}
              </div>
            </div>

            {/* Trust Footer */}
            <div className="preview-security-footer">
              <span>🔒 256-Bit SSL Encrypted</span>
              <span>⚡ Instant Unlocking</span>
              <span>🛡️ 100% Private (No Data Retained)</span>
            </div>
          </div>
        </div>
      </FadeReveal>
    </section>
  );
}
