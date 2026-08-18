import { useState } from 'react';
import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { ContactModal } from '../components/afterchat/ContactModal';
import { FadeReveal } from '../components/afterchat/FadeReveal';

export function PrivacyPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div className="legal-layout-root" style={{ background: '#0a0b0e', minHeight: '100vh', color: '#e8e0d2' }}>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />

      <main className="legal-page-container" style={{ maxWidth: '860px', margin: '0 auto', padding: '120px 24px 80px' }}>
        <FadeReveal>
          {/* Header Banner */}
          <div style={{
            background: 'radial-gradient(100% 100% at 50% 0%, #171d18 0%, #0d0e12 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            padding: '36px 32px',
            marginBottom: '40px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#6ee7b7',
                fontFamily: '"DM Mono", monospace',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '999px'
              }}>
                🔒 ZERO-LOG ARCHITECTURE
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
                DPDP ACT & GDPR COMPLIANT
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
              Privacy Policy
            </h1>

            <p style={{ color: '#b8b0a0', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
              Your private conversations are confidential. We engineered AfterChat around a fundamental principle: <strong>We do not store, sell, or train AI models on your raw personal text messages.</strong>
            </p>
          </div>
        </FadeReveal>

        {/* Core Pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '20px' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>💻</span>
            <strong style={{ color: '#fff', fontSize: '14px', display: 'block', marginBottom: '4px' }}>Client-Side Parsing</strong>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#a8a090', lineHeight: 1.5 }}>
              Message statistics, word clouds, emoji frequencies, and hourly charts are computed in your browser memory via Web Workers.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '20px' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>⚡</span>
            <strong style={{ color: '#fff', fontSize: '14px', display: 'block', marginBottom: '4px' }}>Ephemeral AI Processing</strong>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#a8a090', lineHeight: 1.5 }}>
              AI analysis processes chronological message samples in RAM memory and immediately deletes them upon report compilation.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '20px' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🚫</span>
            <strong style={{ color: '#fff', fontSize: '14px', display: 'block', marginBottom: '4px' }}>Zero Permanent Databases</strong>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#a8a090', lineHeight: 1.5 }}>
              We do not maintain user accounts or persistent server databases of your uploaded WhatsApp .txt archives.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#6ee7b7', margin: '0 0 14px 0' }}>
              1. What Information We Process
            </h2>
            <ul style={{ paddingLeft: '20px', color: '#d4cbb8', lineHeight: 1.7, fontSize: '14px', margin: 0 }}>
              <li><strong>Uploaded WhatsApp .txt Archives:</strong> Processed in volatile memory solely to calculate your charts, detect eras, and write your story. Discarded immediately after processing.</li>
              <li><strong>Email Address (Provided at Checkout):</strong> Used exclusively to transmit your payment receipt and dispatch your full 6-page report PDF. We do not sell your email to marketers.</li>
              <li><strong>Payment Transaction Metadata:</strong> Razorpay Payment IDs and timestamp records maintained strictly for billing verification, receipt generation, and accounting audits.</li>
            </ul>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#6ee7b7', margin: '0 0 14px 0' }}>
              2. Third-Party Service Providers
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: '0 0 12px 0' }}>
              We partner only with industry-leading infrastructure providers that maintain strict confidentiality protocols:
            </p>
            <ul style={{ paddingLeft: '20px', color: '#d4cbb8', lineHeight: 1.7, fontSize: '14px', margin: 0 }}>
              <li><strong>Razorpay Software Pvt. Ltd.:</strong> Level 1 PCI-DSS compliant payment processing for UPI, Cards, and NetBanking.</li>
              <li><strong>Groq Inc. Cloud Inference:</strong> High-performance AI hardware for instant synthesis. Under our API agreement, data sent to Groq endpoints is not used to train public LLMs.</li>
            </ul>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#6ee7b7', margin: '0 0 14px 0' }}>
              3. Data Retention & Your Deletion Rights
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: '0 0 12px 0' }}>
              Because your parsed chat analysis is cached inside your own browser's <code>localStorage</code>, you can wipe all data at any instant simply by clicking the "Start Over" / "Clear Data" button or clearing your browser cookies.
            </p>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: 0 }}>
              To request complete deletion of any billing/email records, email our Data Grievance Officer at <a href="mailto:privacy@afterchat.fun" style={{ color: '#6ee7b7' }}>privacy@afterchat.fun</a>.
            </p>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#6ee7b7', margin: '0 0 14px 0' }}>
              4. Grievance Officer & Inquiries
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: '0 0 10px 0' }}>
              In compliance with the Information Technology Act 2000 and Digital Personal Data Protection (DPDP) Act, you may direct privacy inquiries to:
            </p>
            <div style={{ fontFamily: '"DM Mono", monospace', fontSize: '13px', color: '#d4cbb8', lineHeight: 1.8 }}>
              <div><strong>Grievance Officer:</strong> Rahul Jethwa</div>
              <div><strong>Platform:</strong> AfterChat AI</div>
              <div><strong>Email:</strong> <a href="mailto:privacy@afterchat.fun" style={{ color: '#6ee7b7', textDecoration: 'underline' }}>privacy@afterchat.fun</a></div>
            </div>
          </section>

        </div>
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
