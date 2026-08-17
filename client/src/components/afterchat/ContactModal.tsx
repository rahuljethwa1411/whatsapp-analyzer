import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !query.trim()) return;
    
    setStatus('submitting');
    setTimeout(() => {
      setStatus('submitted');
    }, 800);
  };

  const handleResetAndClose = () => {
    onClose();
    setTimeout(() => {
      setStatus('idle');
      setName('');
      setEmail('');
      setQuery('');
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleResetAndClose}
        >
          <motion.div
            className="modal-content"
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close-btn" onClick={handleResetAndClose} aria-label="Close dialog">
              ✕
            </button>

            {status === 'submitted' ? (
              <div className="modal-success">
                <div className="success-icon">✨</div>
                <h3>Message Received!</h3>
                <p>
                  Thanks for reaching out, <b>{name}</b>! We have received your query and will get back to you shortly.
                </p>
                <button className="button" onClick={handleResetAndClose}>
                  Close <span>→</span>
                </button>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <p className="eyebrow">GET IN TOUCH</p>
                  <h2>Send a message.</h2>
                  <p className="lede">Have a question, feedback, or want to collaborate with our team? Drop a line below.</p>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="contact-name">Your Name</label>
                    <input
                      id="contact-name"
                      type="text"
                      placeholder="e.g. Alex Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-email">Email Address</label>
                    <input
                      id="contact-email"
                      type="email"
                      placeholder="e.g. alex@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-query">Your Query / Message</label>
                    <textarea
                      id="contact-query"
                      rows={4}
                      placeholder="What would you like to ask or share?"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      required
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={handleResetAndClose}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="button modal-submit-btn"
                      disabled={status === 'submitting'}
                    >
                      {status === 'submitting' ? 'Sending...' : 'Send Message'} <span>→</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
