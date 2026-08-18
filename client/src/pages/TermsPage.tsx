import { useState } from 'react';
import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { ContactModal } from '../components/afterchat/ContactModal';
import { FadeReveal } from '../components/afterchat/FadeReveal';

export function TermsPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div className="legal-layout-root" style={{ background: '#0a0b0e', minHeight: '100vh', color: '#e8e0d2' }}>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />

      <main className="legal-page-container" style={{ maxWidth: '860px', margin: '0 auto', padding: '120px 24px 80px' }}>
        <FadeReveal>
          {/* Header Banner */}
          <div style={{
            background: 'radial-gradient(100% 100% at 50% 0%, #1a1714 0%, #0d0e12 100%)',
            border: '1px solid rgba(204, 81, 61, 0.3)',
            borderRadius: '16px',
            padding: '36px 32px',
            marginBottom: '40px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span style={{
                background: 'rgba(204, 81, 61, 0.15)',
                border: '1px solid rgba(204, 81, 61, 0.4)',
                color: '#ff8a75',
                fontFamily: '"DM Mono", monospace',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '999px'
              }}>
                LEGAL AGREEMENT & USER TERMS
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
                EFFECTIVE DATE: FEBRUARY 2025
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
              Terms and Conditions
            </h1>

            <p style={{ color: '#b8b0a0', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
              Please read these terms carefully before accessing or using the AfterChat platform. By uploading WhatsApp text archives or purchasing intelligence reports, you agree to be bound by this agreement.
            </p>
          </div>
        </FadeReveal>

        {/* Legal Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ff8a75', margin: '0 0 14px 0' }}>
              1. Acceptance & Overview of Services
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: '0 0 12px 0' }}>
              <strong>AfterChat</strong> ("we", "us", "our", or the "Platform", available at <a href="https://afterchat.fun" style={{ color: '#cc513d' }}>https://afterchat.fun</a>) provides client-side parsing, algorithmic statistics computation, AI-assisted narrative generation, and classified PDF export dossiers for exported WhatsApp chat logs.
            </p>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: 0 }}>
              By accessing our website or utilizing our intelligence engine, you confirm that you are at least 18 years of age (or have parental/guardian consent) and possess the legal authority to agree to these Terms.
            </p>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ff8a75', margin: '0 0 14px 0' }}>
              2. Content Ownership & Privacy Guarantees
            </h2>
            <div style={{
              background: 'rgba(204, 81, 61, 0.08)',
              borderLeft: '4px solid #cc513d',
              padding: '14px 18px',
              borderRadius: '0 8px 8px 0',
              marginBottom: '16px'
            }}>
              <strong style={{ color: '#fff', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                🛡️ You Retain 100% Ownership of Your Data
              </strong>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#e8e0d2', lineHeight: 1.5 }}>
                AfterChat does not claim any ownership rights over your chat archives, messages, or metadata. All raw message text parsing is computed in memory on your client device and is never stored permanently on our database.
              </p>
            </div>
            <ul style={{ paddingLeft: '20px', color: '#d4cbb8', lineHeight: 1.7, fontSize: '14px' }}>
              <li>You represent and warrant that you have lawful permission and consent from conversation participants before uploading chat logs.</li>
              <li>You agree not to upload content that violates applicable laws, contains unlawful hate speech, or infringes upon third-party intellectual property rights.</li>
            </ul>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ff8a75', margin: '0 0 14px 0' }}>
              3. Payments, Billing & Razorpay Processing
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: '0 0 12px 0' }}>
              All transactions on AfterChat are processed securely via <strong>Razorpay Software Private Limited</strong>, utilizing 256-bit SSL encryption and strict PCI-DSS Level 1 compliance.
            </p>
            <ul style={{ paddingLeft: '20px', color: '#d4cbb8', lineHeight: 1.7, fontSize: '14px' }}>
              <li><strong>Pricing Currency:</strong> All prices are displayed in Indian Rupees (INR). Applicable taxes and gateway conversion rates are calculated automatically at checkout.</li>
              <li><strong>Digital Fulfillment:</strong> Unlocking the full 6-page intelligence dossier and high-res PDF export occurs instantly upon successful HMAC-SHA256 signature verification.</li>
              <li><strong>No Automatic Recurring Subscriptions:</strong> All unlocks are one-time payments. We do not store card credentials or perform unexpected recurring billing.</li>
            </ul>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ff8a75', margin: '0 0 14px 0' }}>
              4. Nature of AI Insights & Satirical Disclaimers
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: 0 }}>
              AfterChat utilizes artificial intelligence to generate satirical summaries, personality archetypes, inside joke chronologies, and playful awards. <strong>All generated narratives are strictly for personal reflection and entertainment.</strong> They do not constitute formal psychological analysis, relationship counseling, or legal evidence in any jurisdiction.
            </p>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ff8a75', margin: '0 0 14px 0' }}>
              5. Governing Law & Dispute Resolution
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: 0 }}>
              These Terms shall be governed by and construed in accordance with the laws of India. Any legal disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts in Gujarat, India.
            </p>
          </section>

          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '28px 32px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ff8a75', margin: '0 0 14px 0' }}>
              6. Contact Information
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4cbb8', fontSize: '14.5px', margin: '0 0 10px 0' }}>
              If you have any questions or require legal clarification, reach out to our team:
            </p>
            <p style={{ margin: 0, fontFamily: '"DM Mono", monospace', fontSize: '13px', color: '#ff8a75' }}>
              📧 Email: <a href="mailto:iamafterchat@gmail.com" style={{ color: '#ff8a75', textDecoration: 'underline' }}>iamafterchat@gmail.com</a>
            </p>
          </section>

        </div>
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
