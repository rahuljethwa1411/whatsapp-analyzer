import { useState } from 'react';
import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { ContactModal } from '../components/afterchat/ContactModal';
import { FadeReveal } from '../components/afterchat/FadeReveal';

const FAQS = [
  {
    q: 'I paid on Razorpay but my report did not unlock. What should I do?',
    a: 'Do not worry! If your payment was debited, your transaction is safely recorded. Simply email iamafterchat@gmail.com with your Razorpay Payment ID (e.g. pay_xxxxxxxxx) or your email, and our system will immediately verify and email your full 6-page PDF dossier.',
  },
  {
    q: 'How do I export a WhatsApp chat file to analyze?',
    a: 'Open WhatsApp on your phone → Open the chat → Tap the Contact Name at top (or 3 dots on Android) → Scroll down and select "Export Chat" → Choose "Without Media" → Upload the generated .txt file to AfterChat.',
  },
  {
    q: 'Are my personal messages stored on your servers?',
    a: 'Never. AfterChat operates with a strict Zero-Log Privacy Architecture. Chat parsing and metric calculations occur locally in your browser memory. AI narrative sampling is ephemeral and immediately erased after generation.',
  },
  {
    q: 'Can I re-download my PDF report or analyze another chat?',
    a: 'Each payment unlocks the full report and PDF download for that specific chat session. You can re-download that report as long as your session is open. If you upload a new chat archive or click "Start Over", the new chat starts with its own free preview.',
  },
];

export function ContactPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Payment / Report Support');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="legal-layout-root" style={{ background: '#0a0b0e', minHeight: '100vh', color: '#e8e0d2' }}>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />

      <main className="legal-page-container" style={{ maxWidth: '860px', margin: '0 auto', padding: '120px 24px 80px' }}>
        <FadeReveal>
          {/* Header Banner */}
          <div style={{
            background: 'radial-gradient(100% 100% at 50% 0%, #1c1514 0%, #0d0e12 100%)',
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
                CUSTOMER CARE & ASSISTANCE
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
                RESPONSE SLA: &lt; 12–24 HOURS
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
              Contact Support
            </h1>

            <p style={{ color: '#b8b0a0', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
              Need help with a payment, report generation, or custom inquiry? Our dedicated engineering and support team is here to assist you.
            </p>
          </div>
        </FadeReveal>

        {/* Quick Contact Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '36px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '22px', borderRadius: '12px' }}>
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '6px' }}>📧</span>
            <span style={{ color: '#ff8a75', fontFamily: '"DM Mono", monospace', fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>DIRECT SUPPORT EMAIL</span>
            <a href="mailto:iamafterchat@gmail.com" style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600, textDecoration: 'underline' }}>iamafterchat@gmail.com</a>
            <small style={{ color: '#8c8270', display: 'block', marginTop: '6px', fontSize: '12px' }}>For billing, refunds, and report help</small>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '22px', borderRadius: '12px' }}>
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '6px' }}>⚡</span>
            <span style={{ color: '#ff8a75', fontFamily: '"DM Mono", monospace', fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>SUPPORT HOURS</span>
            <span style={{ color: '#ffffff', fontSize: '15px', fontWeight: 600, display: 'block' }}>Mon – Sat • 10 AM – 8 PM IST</span>
            <small style={{ color: '#8c8270', display: 'block', marginTop: '6px', fontSize: '12px' }}>Fast ticket resolution within 12–24h</small>
          </div>
        </div>

        {/* Support Ticket Form & FAQ split */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>

          {/* Form */}
          <section style={{
            background: 'radial-gradient(120% 120% at 50% 0%, #15171d 0%, #0d0e12 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '32px',
            borderRadius: '12px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ffffff', margin: '0 0 8px 0' }}>
              Send a Support Message
            </h2>
            <p style={{ color: '#8c8270', fontSize: '13px', margin: '0 0 24px 0' }}>
              Fill out the details below and our team will get back to you directly via email.
            </p>

            {submitted ? (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid #10b981',
                padding: '24px',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#86efac'
              }}>
                <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>✓</span>
                <strong style={{ fontSize: '16px', display: 'block', marginBottom: '6px' }}>Support Ticket Submitted Successfully!</strong>
                <p style={{ margin: 0, color: '#e8e0d2', fontSize: '14px', lineHeight: 1.5 }}>
                  Thank you, {name}. A confirmation was logged. We will review your query and reply to <strong>{email}</strong> shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#d4cbb8', fontWeight: 600 }}>
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Jethwa"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={{ width: '100%', padding: '11px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#d4cbb8', fontWeight: 600 }}>
                      Your Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. rahul@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ width: '100%', padding: '11px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#d4cbb8', fontWeight: 600 }}>
                    Inquiry Topic
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: '100%', padding: '11px 14px', background: '#12141a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  >
                    <option value="Payment / Report Support">Payment / Report Unlock Support</option>
                    <option value="Refund Request">Technical Refund Request</option>
                    <option value="PDF Export Issue">PDF Export / Rendering Issue</option>
                    <option value="General Feedback">General Inquiries & Feedback</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#d4cbb8', fontWeight: 600 }}>
                    Message / Transaction Details
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Please include your Razorpay payment ID (e.g. pay_xxxxxxxxx) if this is regarding a transaction."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={{ width: '100%', padding: '11px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #cc513d 0%, #b83a27 100%)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    padding: '13px 20px',
                    cursor: 'pointer',
                    marginTop: '6px'
                  }}
                >
                  Submit Support Ticket →
                </button>
              </form>
            )}
          </section>

          {/* Instant FAQ Accordion */}
          <section style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            padding: '28px 32px',
            borderRadius: '12px'
          }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.35rem', color: '#ff8a75', margin: '0 0 16px 0' }}>
              Frequently Answered Questions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {FAQS.map((faq, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '14px 18px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{faq.q}</span>
                    <span style={{ color: '#ff8a75', fontSize: '16px' }}>{openFaq === idx ? '−' : '+'}</span>
                  </button>
                  {openFaq === idx && (
                    <div style={{ padding: '0 18px 16px', color: '#b8b0a0', fontSize: '13.5px', lineHeight: 1.6 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
