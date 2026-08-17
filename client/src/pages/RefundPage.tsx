import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { useState } from 'react';
import { ContactModal } from '../components/afterchat/ContactModal';

export function RefundPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />
      <main className="legal-page" style={{ maxWidth: '800px', margin: '120px auto 80px', padding: '0 24px', color: '#eae3d6', fontFamily: 'Georgia, serif', lineHeight: 1.7 }}>
        <p style={{ color: '#cc513d', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: '"Courier New", monospace', fontWeight: 'bold' }}>
          TRANSPARENCY & ASSURANCE
        </p>
        <h1 style={{ fontSize: '38px', color: '#f4f0e8', marginBottom: '8px', fontFamily: 'Georgia, serif' }}>Refund & Cancellation Policy</h1>
        <p style={{ color: '#8a8376', fontSize: '14px', marginBottom: '40px', fontFamily: '"Courier New", monospace' }}>
          Last Updated: February 2025 • Clear & Fair Policy
        </p>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>1. Digital Goods Nature</h2>
          <p>
            AfterChat provides instant, computationally generated digital reports, character analyses, and downloadable high-resolution PDF dossiers. 
          </p>
          <div style={{ background: '#262420', borderLeft: '4px solid #cc513d', padding: '16px 20px', margin: '16px 0', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontStyle: 'italic', color: '#f4f0e8' }}>
              "Instant digital download service — once payment is confirmed and the full intelligence dossier / PDF report is unlocked or generated, the service is deemed fulfilled and non-refundable under standard consumer digital goods terms."
            </p>
          </div>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>2. Technical Failure & Defect Guarantee (100% Refundable)</h2>
          <p>
            We stand behind our technology. You are entitled to a full <strong>100% refund</strong> under the following circumstances:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '12px' }}>
            <li style={{ marginBottom: '8px' }}><strong>Payment debited but report failed to unlock:</strong> If your account was charged by Razorpay but a network disconnect or server timeout prevented the generation or download of your report.</li>
            <li style={{ marginBottom: '8px' }}><strong>Corrupt PDF or generation error:</strong> If the generated PDF output is completely unreadable or blank due to an unrecoverable system crash.</li>
            <li style={{ marginBottom: '8px' }}><strong>Duplicate charges:</strong> If you were accidentally charged twice for the same single chat report.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>3. How to Request a Refund</h2>
          <p>
            To claim a refund for a technical issue:
          </p>
          <ol style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li style={{ marginBottom: '6px' }}>Email us at <a href="mailto:support@afterchat.fun" style={{ color: '#cc513d' }}>support@afterchat.fun</a> within <strong>7 days</strong> of your transaction.</li>
            <li style={{ marginBottom: '6px' }}>Include your <strong>Razorpay Payment ID</strong> (e.g. <code>pay_xxxxxxxxx</code>) and the email address entered during checkout.</li>
            <li style={{ marginBottom: '6px' }}>Describe the technical issue encountered.</li>
          </ol>
          <p style={{ marginTop: '12px' }}>
            Once verified, refunds are processed directly back to your original payment method (Bank account, Card, or UPI) within <strong>5–7 business days</strong> as per banking network standards.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#f4f0e8', marginBottom: '12px', borderBottom: '1px solid #3d3a34', paddingBottom: '8px' }}>4. Cancellations</h2>
          <p>
            Because reports are delivered on-demand within seconds of checkout, cancellations after report generation cannot be accommodated once the download has begun.
          </p>
        </section>
      </main>
      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  );
}
