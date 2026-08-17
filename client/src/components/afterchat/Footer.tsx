import { motion } from 'framer-motion';

interface FooterProps {
  onOpenContact?: () => void;
}

export function Footer({ onOpenContact }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <a href="/" className="brand-logo">
            AFTERCHAT <span className="logo-spark">✦</span>
          </a>
          <p className="footer-tagline">
            Turning raw WhatsApp chat exports into documented lore, key statistics, and stories worth remembering.
          </p>
        </div>

        <div className="footer-nav">
          <div className="footer-col">
            <span className="footer-heading">NAVIGATION</span>
            <a href="/">Home</a>
            <a href="/#how">How it works</a>
            <a href="/#examples">Examples</a>
            <a href="/upload">Upload Chat</a>
          </div>

          <div className="footer-col">
            <span className="footer-heading">LEGAL & POLICIES</span>
            <a href="/terms">Terms & Conditions</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/refund">Refund Policy</a>
            <a href="/contact">Contact Support</a>
          </div>

          <div className="footer-col">
            <span className="footer-heading">CONNECT</span>
            <a href="/contact">Support Email</a>
            {onOpenContact && (
              <button onClick={onOpenContact} className="footer-link-btn">
                Contact Modal
              </button>
            )}
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              GitHub ↗
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
              Twitter / X ↗
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="credit">
          Made with{' '}
          <motion.span
            className="heart-emoji"
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          >
            ❤️
          </motion.span>{' '}
          by <b>AfterChat Team</b>
        </p>
        <p className="copyright">© {new Date().getFullYear()} AfterChat. All chats parsed locally.</p>
      </div>
    </footer>
  );
}
