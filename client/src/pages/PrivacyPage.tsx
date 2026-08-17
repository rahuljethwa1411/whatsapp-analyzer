import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { useState } from 'react';
import { ContactModal } from '../components/afterchat/ContactModal';

export function PrivacyPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />
      <main className="legal-page" style={{ maxWidth: '800px', margin: '120px auto 80px', padding: '0 24px', color: '#eae3d6', fontFamily: 'Georgia, serif', lineHeight: 1.7 }}>
        <p style={{ color: '#cc513d', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: '"Courier New", monospace', fontWeight: 'bold' }}>
          PRIVACY FIRST ARCHITECTURE
        </p>
        <h1 style={{ fontSize: '38px', color: '#f4f0e8', marginBottom: '8px', fontFamily: 'Georgia, serif' }}>Privacy Policy</h1>
        <p style={{ color: '#8a8376', fontSize: '14px', marginBottom: '40px', fontFamily: '"Courier New", monospace' }}>
          Last Updated: February 2025 • Strict Zero-Storage Guarantee
        </p>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>1. How We Treat Your Private Conversations</h2>
          <p>
            At <strong>AfterChat</strong>, privacy is not a checkbox—it is our core engineering foundation. We understand WhatsApp chats contain your most intimate memories, inside jokes, and personal records.
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '12px' }}>
            <li style={{ marginBottom: '8px' }}><strong>Local Browser Parsing:</strong> Your message counts, activity graphs, word frequencies, and emoji analytics are calculated locally on your device in your browser using Web Workers.</li>
            <li style={{ marginBottom: '8px' }}><strong>Zero Permanent Storage:</strong> We do not store, archive, or maintain databases of your raw text messages on our servers.</li>
            <li style={{ marginBottom: '8px' }}><strong>Ephemeral AI Extraction:</strong> During AI intelligence synthesis, chronological text samples are processed in memory and immediately discarded once summary statistics are compiled.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>2. Payment Information</h2>
          <p>
            Payment transactions are handled directly through <strong>Razorpay Software Private Limited</strong>. AfterChat does not collect, process, or store credit card numbers, debit card PINs, CVVs, or NetBanking credentials on our servers. Razorpay processes transactions via 256-bit SSL encryption adhering to PCI-DSS Level 1 compliance.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>3. Information We Collect</h2>
          <p>
            When you complete a purchase or contact support, we only collect:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li>Email address & contact name (for payment receipt dispatch and customer support).</li>
            <li>Razorpay Transaction ID (to verify access to premium report features).</li>
            <li>Aggregated, anonymous technical diagnostics (browser type, error rates).</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>4. Third-Party Services</h2>
          <p>
            We use trusted industry infrastructure partners:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li><strong>Razorpay:</strong> Secure payment processing.</li>
            <li><strong>Groq:</strong> High-speed AI inference for synthesizing conversational themes.</li>
            <li><strong>Render:</strong> Cloud application hosting with TLS encryption.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>5. Contact Our Privacy Officer</h2>
          <p>
            If you have questions regarding data privacy or wish to request information removal, email us at <a href="mailto:privacy@afterchat.fun" style={{ color: '#cc513d' }}>privacy@afterchat.fun</a> or <a href="mailto:support@afterchat.fun" style={{ color: '#cc513d' }}>support@afterchat.fun</a>.
          </p>
        </section>
      </main>
      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  );
}
