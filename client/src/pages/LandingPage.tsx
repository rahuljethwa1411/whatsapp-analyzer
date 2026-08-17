import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeReveal } from '../components/afterchat/FadeReveal';
import { Navbar } from '../components/afterchat/Navbar';
import { Footer } from '../components/afterchat/Footer';
import { ContactModal } from '../components/afterchat/ContactModal';
import chatExportStory from '../assets/chat-export-story.png';

const timeline = [
  'THE BEGINNING',
  'THE GOLDEN ERA',
  'THE CHAOS',
  'THE PLOT TWIST',
  'THE AFTERMATH',
];

const sampleExamples = [
  {
    id: 'college-gang',
    tag: 'FRIEND GROUP',
    title: 'The College Gang',
    subtitle: '24,821 messages · 4 members · 2 years',
    genre: 'Chaotic Comfort',
    highlight: 'Mentioned “Goa trip” 17 times. Trips taken: 0.',
    quote: '“bro we’re actually going Goa this time... 100%... booking tomorrow”',
    stats: ['Peak: 1:17 AM', '427 "bro"s', 'Top emoji: 💀'],
  },
  {
    id: 'gaming-crew',
    tag: 'GAMING / DISCORD CHAT',
    title: 'Late Night Squad',
    subtitle: '14,310 messages · 5 members · 1.5 years',
    genre: 'Unfiltered Banter',
    highlight: '38 excuses for missing the 10 PM lobby.',
    quote: '“im on my way home... (sent from bed)”',
    stats: ['Peak: 3:14 AM', '92 voice notes', 'Top emoji: 🤡'],
  },
  {
    id: 'crush-lore',
    tag: 'PARTNER / BEST FRIEND',
    title: 'Late Night Texts',
    subtitle: '48,190 messages · 2 people · 3 years',
    genre: 'Romantic Comedy',
    highlight: '114 arguments over what restaurant to order from.',
    quote: '“what do u wanna eat?” → “anything u want” → 45 minutes of silence',
    stats: ['Peak: 12:45 AM', '942 "miss u"s', 'Top emoji: 🥹'],
  },
];

const faqs = [
  {
    q: 'Is my exported WhatsApp chat uploaded to any server?',
    a: 'No. All analysis happens 100% locally in your browser session. Your chat file never leaves your device and is not saved or uploaded anywhere.',
  },
  {
    q: 'How do I export my WhatsApp chat without media?',
    a: 'Open WhatsApp, go to the group or contact chat settings, select "Export Chat", and choose "Without Media" (or With Media). You can upload the .txt or .zip file directly.',
  },
  {
    q: 'Does AfterChat work with large chats?',
    a: 'Yes! AfterChat can process tens of thousands of lines in seconds directly inside your browser.',
  },
  {
    q: 'Do I need WhatsApp API or account permissions?',
    a: 'No API, phone connection, or account logins required. You only provide the plain text export file.',
  },
];

export function LandingPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [activeExample, setActiveExample] = useState<string | null>(null);
  const [heroTab, setHeroTab] = useState<'receipts' | 'eras' | 'cast'>('receipts');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const currentExample = sampleExamples.find((ex) => ex.id === activeExample);

  return (
    <>
      <Navbar onOpenContact={() => setIsContactOpen(true)} />
      <main>
        <section className="hero hero-with-illustration">
          <FadeReveal>
            <p className="eyebrow">AFTERCHAT · A CONVERSATION DOCUMENTARY</p>
            <h1>
              Your chat
              <br />
              has a <em>story.</em>
            </h1>
            <p className="lede">
              We find the moments, patterns and lore hiding inside your conversations.
            </p>
            <div className="hero-cta-group">
              <a className="button" href="/upload">
                Upload your chat <span>→</span>
              </a>
            </div>

            {/* Trust Badges */}
            <div className="hero-trust-row">
              <span className="trust-pill">🔒 100% Private (Runs in Browser)</span>
              <span className="trust-pill">⚡ Instant Processing</span>
              <span className="trust-pill">📁 No Media Required</span>
            </div>
          </FadeReveal>

          <FadeReveal className="hero-illustration">
            <img src={chatExportStory} alt="An exported group chat transforming into a story" />
            <p>Export a chat. Find the story.</p>
          </FadeReveal>
        </section>

        {/* 01 · THE RETELLING (Story Preview First) */}
        <section className="wide story-preview">
          <FadeReveal>
            <p className="eyebrow">01 · THE RETELLING</p>
            <h2>We turn it into a story.</h2>
          </FadeReveal>
          <FadeReveal className="paper">
            <p>March 2024.</p>
            <p>Four people entered a group chat with absolutely no idea what they were doing.</p>
            <p>The conversation was normal for approximately twelve minutes.</p>
            <p>Then someone mentioned Goa.</p>
            <p>
              This would become important later.
              <br />
              Mostly because it never happened.
            </p>
          </FadeReveal>
        </section>

        {/* 02 · THE EVIDENCE (Stats Section Second) */}
        <section id="how" className="wide split">
          <FadeReveal>
            <p className="eyebrow">02 · THE EVIDENCE</p>
            <h2>There's more in there than you remember.</h2>

            {/* Interactive Preview Widget */}
            <div className="hero-preview-box" style={{ marginTop: 32, transform: 'none' }}>
              <div className="hero-preview-tabs">
                <button
                  className={heroTab === 'receipts' ? 'active' : ''}
                  onClick={() => setHeroTab('receipts')}
                >
                  Receipts
                </button>
                <button
                  className={heroTab === 'eras' ? 'active' : ''}
                  onClick={() => setHeroTab('eras')}
                >
                  Eras
                </button>
                <button
                  className={heroTab === 'cast' ? 'active' : ''}
                  onClick={() => setHeroTab('cast')}
                >
                  Cast
                </button>
              </div>

              <div className="hero-preview-body">
                <AnimatePresence mode="wait">
                  {heroTab === 'receipts' && (
                    <motion.div
                      key="receipts"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <span className="preview-label">RECURRING LORE</span>
                      <p className="preview-heading">Mentioned “Goa” 17 times.</p>
                      <p className="preview-quote">“bro we’re actually going Goa this time...”</p>
                      <small className="preview-foot">Trips taken: 0</small>
                    </motion.div>
                  )}

                  {heroTab === 'eras' && (
                    <motion.div
                      key="eras"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <span className="preview-label">CHAT TIMELINE</span>
                      <p className="preview-heading">7 distinct eras identified</p>
                      <ul className="preview-list">
                        <li><b>01</b> The Beginning (Mar 2024)</li>
                        <li><b>02</b> The Golden Era (Jun 2024)</li>
                        <li><b>03</b> The Incident (Mar 2025)</li>
                      </ul>
                    </motion.div>
                  )}

                  {heroTab === 'cast' && (
                    <motion.div
                      key="cast"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <span className="preview-label">CHARACTER ARCHETYPES</span>
                      <p className="preview-heading">Alex: The Instigator</p>
                      <p className="preview-sub">“Proposes 68 plans, leaves everyone with a spreadsheet.”</p>
                      <small className="preview-foot">Sam: The Therapist (91 check-ins)</small>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </FadeReveal>
          <FadeReveal className="mega-stat">
            <b>24,821</b>
            <small>
              messages <em>example chat</em>
            </small>
            <p>Somewhere in all of that is a story.</p>
          </FadeReveal>
        </section>

        <section className="wide discovery">
          <FadeReveal>
            <p className="eyebrow">03 · THE RECEIPTS</p>
            <h2>
              We find the moments
              <br />
              you forgot.
            </h2>
          </FadeReveal>
          <FadeReveal className="goa">
            <span>ONE RECURRING IDEA</span>
            <strong>
              You mentioned
              <br />
              <i>Goa</i> 17 times.
            </strong>
            <hr />
            <p>
              Trips actually taken: <b>0</b>
            </p>
          </FadeReveal>
        </section>

        <section className="wide">
          <FadeReveal>
            <p className="eyebrow">04 · THE TIMELINE</p>
            <h2>Every chat has eras.</h2>
          </FadeReveal>
          <FadeReveal className="timeline">
            {timeline.map((era, index) => (
              <div key={era}>
                <i />
                <span>{String(index + 1).padStart(2, '0')}</span>
                {era}
              </div>
            ))}
          </FadeReveal>
        </section>

        {/* Dedicated #examples section */}
        <section id="examples" className="wide examples-section">
          <FadeReveal>
            <p className="eyebrow">05 · SAMPLE ARCHIVES</p>
            <h2>Explore sample AfterChats.</h2>
            <p className="lede">
              Click any sample chat below to inspect how AfterChat uncovers patterns, running jokes, and eras.
            </p>
          </FadeReveal>

          <div className="examples-grid">
            {sampleExamples.map((ex) => (
              <FadeReveal key={ex.id}>
                <motion.div
                  className="example-card"
                  whileHover={{ y: -6, boxShadow: '0 16px 32px rgba(32, 31, 28, 0.12)' }}
                  onClick={() => setActiveExample(ex.id)}
                >
                  <span className="example-tag">{ex.tag}</span>
                  <h3>{ex.title}</h3>
                  <p className="example-sub">{ex.subtitle}</p>
                  <div className="example-badge">{ex.genre}</div>
                  <p className="example-highlight">{ex.highlight}</p>
                  <button className="text-button example-preview-btn">
                    Inspect Lore ↗
                  </button>
                </motion.div>
              </FadeReveal>
            ))}
          </div>

          <div className="example-cta-banner">
            <p>Want to see what your chat documentary looks like?</p>
            <a className="button" href="/upload">
              Analyze your chat now <span>→</span>
            </a>
          </div>
        </section>

        {/* Interactive FAQ Section */}
        <section className="wide faq-section">
          <FadeReveal>
            <p className="eyebrow">06 · TRANSPARENCY & FREQUENT QUESTIONS</p>
            <h2>Everything you need to know.</h2>
          </FadeReveal>

          <div className="faq-accordion">
            {faqs.map((faq, index) => (
              <FadeReveal key={faq.q}>
                <div
                  className={'faq-item ' + (openFaqIndex === index ? 'open' : '')}
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                >
                  <div className="faq-question">
                    <h3>{faq.q}</h3>
                    <span>{openFaqIndex === index ? '−' : '+'}</span>
                  </div>
                  <AnimatePresence>
                    {openFaqIndex === index && (
                      <motion.p
                        className="faq-answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        {faq.a}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </FadeReveal>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <FadeReveal>
            <p className="eyebrow">YOUR ARCHIVE IS WAITING</p>
            <h2>
              What's your <em>lore?</em>
            </h2>
            <a className="button" href="/upload">
              Upload your chat <span>→</span>
            </a>
          </FadeReveal>
        </section>
      </main>

      <Footer onOpenContact={() => setIsContactOpen(true)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />

      {/* Interactive Example Preview Modal */}
      <AnimatePresence>
        {currentExample && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveExample(null)}
          >
            <motion.div
              className="modal-content example-modal-content"
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close-btn"
                onClick={() => setActiveExample(null)}
              >
                ✕
              </button>
              <p className="eyebrow">{currentExample.tag} · SAMPLE REPORT</p>
              <h2>{currentExample.title}</h2>
              <p className="lede">{currentExample.subtitle}</p>

              <div className="example-details-box">
                <div className="example-detail-item">
                  <b>GENRE</b>
                  <span>{currentExample.genre}</span>
                </div>
                <div className="example-detail-item">
                  <b>KEY LORE</b>
                  <span>{currentExample.highlight}</span>
                </div>
                <div className="example-detail-item">
                  <b>EXCERPT RECEIPT</b>
                  <p className="example-quote">{currentExample.quote}</p>
                </div>
              </div>

              <div className="example-stats-row">
                {currentExample.stats.map((s) => (
                  <span key={s} className="example-stat-pill">
                    {s}
                  </span>
                ))}
              </div>

              <div className="modal-actions" style={{ marginTop: 28 }}>
                <button className="text-button" onClick={() => setActiveExample(null)}>
                  Close
                </button>
                <a className="button" href="/upload">
                  Try with your chat <span>→</span>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


