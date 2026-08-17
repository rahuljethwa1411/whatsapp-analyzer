import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { useState } from 'react';
import { ContactModal } from '../components/afterchat/ContactModal';

export function ContactPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Payment / Report Support');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />
      <main className="legal-page" style={{ maxWidth: '800px', margin: '120px auto 80px', padding: '0 24px', color: '#eae3d6', fontFamily: 'Georgia, serif', lineHeight: 1.7 }}>
        <p style={{ color: '#cc513d', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: '"Courier New", monospace', fontWeight: 'bold' }}>
          CUSTOMER CARE & SUPPORT
        </p>
        <h1 style={{ fontSize: '38px', color: '#f4f0e8', marginBottom: '8px', fontFamily: 'Georgia, serif' }}>Contact Us</h1>
        <p style={{ color: '#8a8376', fontSize: '14px', marginBottom: '32px', fontFamily: '"Courier New", monospace' }}>
          We typically respond within 12–24 hours on business days.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <div style={{ background: '#201f1c', border: '1px solid #3d3a34', padding: '24px', borderRadius: '8px' }}>
            <h3 style={{ color: '#cc513d', fontSize: '16px', margin: '0 0 8px 0', fontFamily: '"Courier New", monospace' }}>📧 SUPPORT EMAIL</h3>
            <p style={{ margin: 0, fontSize: '15px' }}>
              <a href="mailto:support@afterchat.fun" style={{ color: '#f4f0e8', textDecoration: 'underline' }}>support@afterchat.fun</a>
            </p>
            <small style={{ color: '#8a8376', display: 'block', marginTop: '6px' }}>For refunds, payment queries & report issues</small>
          </div>

          <div style={{ background: '#201f1c', border: '1px solid #3d3a34', padding: '24px', borderRadius: '8px' }}>
            <h3 style={{ color: '#cc513d', fontSize: '16px', margin: '0 0 8px 0', fontFamily: '"Courier New", monospace' }}>⚡ OPERATING HOURS</h3>
            <p style={{ margin: 0, fontSize: '15px', color: '#f4f0e8' }}>Monday – Saturday</p>
            <small style={{ color: '#8a8376', display: 'block', marginTop: '6px' }}>10:00 AM – 8:00 PM IST</small>
          </div>
        </div>

        <section style={{ background: '#1c1b18', border: '1px solid #3d3a34', padding: '32px', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '22px', color: '#f4f0e8', marginBottom: '16px' }}>Send Support Ticket</h2>
          {submitted ? (
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #86efac', padding: '20px', borderRadius: '6px', textAlign: 'center', color: '#16a34a' }}>
              <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 6px 0' }}>✓ Support Message Received</p>
              <p style={{ margin: 0, color: '#e8e0d2', fontSize: '14px' }}>Thank you, {name}. Our team will get back to you at <strong>{email}</strong> shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#b8b0a0' }}>Your Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', background: '#262420', border: '1px solid #4a463e', color: '#f4f0e8', borderRadius: '6px', fontSize: '15px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#b8b0a0' }}>Your Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', background: '#262420', border: '1px solid #4a463e', color: '#f4f0e8', borderRadius: '6px', fontSize: '15px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#b8b0a0' }}>Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', background: '#262420', border: '1px solid #4a463e', color: '#f4f0e8', borderRadius: '6px', fontSize: '15px' }}
                >
                  <option value="Payment / Report Support">Payment / Report Support</option>
                  <option value="Refund Request">Refund Request</option>
                  <option value="Bug / Error Report">Bug / Error Report</option>
                  <option value="General Feedback">General Feedback / Collaboration</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#b8b0a0' }}>Message / Details</label>
                <textarea
                  rows={5}
                  required
                  placeholder="Please include your Razorpay payment ID if you have questions regarding a transaction."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', background: '#262420', border: '1px solid #4a463e', color: '#f4f0e8', borderRadius: '6px', fontSize: '15px' }}
                />
              </div>

              <button
                type="submit"
                className="button"
                style={{ padding: '14px', background: '#cc513d', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', marginTop: '8px' }}
              >
                Submit Ticket ↗
              </button>
            </form>
          )}
        </section>
      </main>
      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  );
}
