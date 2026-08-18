import { useState } from 'react';
import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { ContactModal } from '../components/afterchat/ContactModal';
import { FadeReveal } from '../components/afterchat/FadeReveal';

export function RefundPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div className="legal-layout-root" style={{ background: '#0a0b0e', minHeight: '100vh', color: '#e8e0d2' }}>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />

      <main className="legal-page-container" style={{ maxWidth: '860px', margin: '0 auto', padding: '120px 24px 80px' }}>
        <FadeReveal>
          {/* Header Banner */}
          <div style={{
            background: 'radial-gradient(100% 100% at 50% 0%, #1f1b14 0%, #0d0e12 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '16px',
            padding: '36px 32px',
            marginBottom: '40px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fbbf24',
                fontFamily: '"DM Mono", monospace',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '999px'
              }}>
                ⚡ 100% TECHNICAL DEFECT GUARANTEE
              </span>
              <span style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#a8a090',
                fontFamily: '"DM Mono", monospace',
                fontSize: '11px',
                padding: '4px 12px',
                borderRadius: '999px'
              }}>
                7-DAY FAIR CLAIM WINDOW
              </span>
            </div>

            <h1 style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#ffffff',
              margin: '0 0 12px 0',
              lineHeight: 1.2
            }}>
              Refund & Cancellation Policy
            </h1>

            <p style={{ color: '#b8b0a0', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
              We pride ourselves on transparent billing and technical excellence. If an unrecoverable system failure prevents you from enjoying your full dossier, we make getting a refund simple and hassle-free.
            </p>
          </div>
        </FadeReveal>

        {/* 3 Step Refund Process */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '24px 28px',
          marginBottom: '32px'
        }}>
          <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.2rem', color: '#fbbf24', margin: '0 0 16px 0' }}>
            ⚡ 3-Step Simple Refund Process
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: '#fbbf24', fontFamily: '"DM Mono", monospace', fontSize: '12px', fontWeight: 'bold' }}>STEP 01</span>
              <strong style={{ display: 'block', color: '#fff', fontSize: '14px', margin: '6px 0 4px' }}>Email Support</strong>
              <p style={{ margin: 0, fontSize: '12px', color: '#a8a090', lineHeight: 1.5 }}>
                Send your Razorpay Payment ID to <a href="mailto:support@afterchat.fun" style={{ color: '#fbbf24' }}>support@afterchat.fun</a> within 7 days.
              </p>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: '#fbbf24', fontFamily: '"DM Mono", monospace', fontSize: '12px', fontWeight: 'bold' }}>STEP 02</span>
              <strong style={{ display: 'block', color: '#fff', fontSize: '14px', margin: '6px 0 4px' }}>Verification</strong>
              <p style={{ margin: 0, fontSize: '12px', color: '#a8a090', lineHeight: 1.5 }}>
                Our engineering team verifies the transaction log and technical failure within 12–24 hours.
              </p>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: '#fbbf24', fontFamily: '"DM Mono", monospace', fontSize: '12px', fontWeight: 'bold' }}>STEP 03</span>
              <strong style={{ display: 'block', color: '#fff', fontSize: '14px', margin: '6px 0 4px' }}>100% Reversal</strong>
              <p style={{ margin: 0, fontSize: '12px', color: '#a8a090', lineHeight: 1.5 }}>
                Funds are reversed directly to your original UPI account or card in 5–7 business days.
              </p>
            </div>
          </div>
        </div>

        {/* Policy Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#fbbf24', margin: '0 0 14px 0' }}>
              1. Eligible Refund Scenarios (100% Full Refund)
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: '0 0 12px 0' }}>
              You will always receive a prompt 100% full refund under any of the following technical conditions:
            </p>
            <ul style={{ paddingLeft: '20px', color: '#d4cbb8', lineHeight: 1.7, fontSize: '14px', margin: 0 }}>
              <li><strong>Payment Charged but Report Failed to Unlock:</strong> If Razorpay debited your funds but a browser crash, network error, or server disconnect prevented your report from unlocking.</li>
              <li><strong>Corrupt / Unreadable PDF Export:</strong> If our automated rendering engine generated a blank, cut-off, or unreadable PDF document.</li>
              <li><strong>Duplicate Transaction Charges:</strong> If network latency or multiple rapid button clicks created two charges for a single chat report.</li>
            </ul>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#fbbf24', margin: '0 0 14px 0' }}>
              2. Digital Goods Fulfillment & Non-Refundable Situations
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: '0 0 12px 0' }}>
              Because AfterChat delivers computational digital intelligence and downloadable PDF dossiers that are delivered instantly upon checkout, refunds cannot be granted under standard digital fulfillment rules once:
            </p>
            <ul style={{ paddingLeft: '20px', color: '#d4cbb8', lineHeight: 1.7, fontSize: '14px', margin: 0 }}>
              <li>The complete 6-page report and all 10 chapters have been generated and viewed successfully on your device.</li>
              <li>The customer expresses subjective dissatisfaction with the humorous or satirical tone of the narrative (sample previews are provided for evaluation prior to purchase).</li>
              <li>The user uploaded an incorrect or empty .txt export file (we encourage verifying your WhatsApp export file size first).</li>
            </ul>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#fbbf24', margin: '0 0 14px 0' }}>
              3. Processing Timelines & Banking Rails
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: 0 }}>
              Approved refunds are initiated immediately through Razorpay's API back to your original source of payment. Depending on your bank's clearance cycles (UPI / Visa / Mastercard / Netbanking), the amount reflects in your account within <strong>5–7 business days</strong>.
            </p>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#fbbf24', margin: '0 0 14px 0' }}>
              4. Need Help with a Transaction?
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: '0 0 10px 0' }}>
              We are here to help resolve any billing inquiry quickly:
            </p>
            <p style={{ margin: 0, fontFamily: '"DM Mono", monospace', fontSize: '13px', color: '#fbbf24' }}>
              📧 Email: <a href="mailto:support@afterchat.fun" style={{ color: '#fbbf24', textDecoration: 'underline' }}>support@afterchat.fun</a>
            </p>
          </section>

        </div>
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
