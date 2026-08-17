import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  summary?: string;
}

export function ShareModal({ isOpen, onClose, title = 'Our WhatsApp Group', summary = '24,821 messages · 7 Eras · 17 Goa mentions · 0 trips taken' }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const shareText = `📜 AFTERCHAT DOCUMENTARY FOR ${title.toUpperCase()} 📜\n\n"${summary}"\n\nGenre: Chaotic Comfort\nTop Emoji: 💀\n\nGenerated with AfterChat ✦`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-content share-modal-content"
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
              ✕
            </button>

            <div className="modal-header">
              <p className="eyebrow">SHARE THE RECEIPTS</p>
              <h2>Share your AfterChat</h2>
              <p className="lede">Send this documentary summary directly to your group chat or post it online.</p>
            </div>

            <div className="share-preview-card">
              <span className="share-badge">AFTERCHAT ✦ RECEIPT</span>
              <h3>{title}</h3>
              <p className="share-stats">{summary}</p>
              <div className="share-quote">
                “Goa this summer?” → “100%” → (17 mentions, 0 trips taken)
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button type="button" className="text-button" onClick={onClose}>
                Done
              </button>
              <button type="button" className="button" onClick={handleCopy}>
                {copied ? 'Copied to Clipboard! ✓' : 'Copy Text for WhatsApp'} <span>→</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
