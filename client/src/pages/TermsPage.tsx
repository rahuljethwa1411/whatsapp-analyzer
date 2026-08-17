import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { useState } from 'react';
import { ContactModal } from '../components/afterchat/ContactModal';

export function TermsPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />
      <main className="legal-page" style={{ maxWidth: '800px', margin: '120px auto 80px', padding: '0 24px', color: '#eae3d6', fontFamily: 'Georgia, serif', lineHeight: 1.7 }}>
        <p style={{ color: '#cc513d', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: '"Courier New", monospace', fontWeight: 'bold' }}>
          LEGAL & COMPLIANCE
        </p>
        <h1 style={{ fontSize: '38px', color: '#f4f0e8', marginBottom: '8px', fontFamily: 'Georgia, serif' }}>Terms & Conditions</h1>
        <p style={{ color: '#8a8376', fontSize: '14px', marginBottom: '40px', fontFamily: '"Courier New", monospace' }}>
          Last Updated: February 2025 • Effective Immediately
        </p>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>1. Overview & Acceptance</h2>
          <p>
            Welcome to <strong>AfterChat</strong> (accessible at <a href="https://afterchat.fun" style={{ color: '#cc513d' }}>https://afterchat.fun</a>). By uploading chat archives or utilizing our intelligence analysis, you agree to comply with and be bound by these Terms and Conditions. If you disagree with any part of these terms, please do not use our service.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>2. Services Provided</h2>
          <p>
            AfterChat provides automated conversational intelligence, statistics, narrative generation, and PDF export dossiers for WhatsApp text archives. Free preview tiers provide sample summaries, while full dossier access requires a one-time digital purchase.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>3. User Responsibilities & Content Ownership</h2>
          <p>
            You represent and warrant that you have the right and explicit consent of conversation participants to parse and analyze any chat files uploaded to AfterChat. You retain 100% ownership of your raw text data. AfterChat does not sell or distribute your private conversation logs to third parties.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>4. Payments & Billing</h2>
          <p>
            All digital payments on AfterChat are securely processed via <strong>Razorpay</strong> (PCI-DSS compliant). Prices are listed in INR (Indian Rupees) with currency conversion handled automatically for international cardholders. Upon successful verification of payment, full report features and PDF export capabilities are immediately unlocked.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>5. Limitation of Liability</h2>
          <p>
            AfterChat's satirical narratives, character awards, and relationship summaries are generated for entertainment and reflective documentation purposes only. They do not constitute legal, psychological, or relationship counseling advice.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>6. Contact & Grievances</h2>
          <p>
            For any questions or legal inquiries regarding these terms, please contact us at <a href="mailto:support@afterchat.fun" style={{ color: '#cc513d' }}>support@afterchat.fun</a> or via our contact portal.
          </p>
        </section>
      </main>
      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  );
}
