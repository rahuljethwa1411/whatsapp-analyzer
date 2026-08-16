import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface NavbarProps {
  onOpenContact?: () => void;
}

export function Navbar({ onOpenContact }: NavbarProps) {
  const [theme, setTheme] = useState<'paper' | 'dark'>(() => {
    return (localStorage.getItem('afterchat_theme') as 'paper' | 'dark') || 'paper';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('afterchat_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'paper' ? 'dark' : 'paper'));
  };

  return (
    <nav className="navbar">
      <a className="brand-logo" href="/">
        <span className="logo-badge">AFTERCHAT</span>
        <span className="logo-spark">✦</span>
      </a>

      <span className="navlinks">
        <a href="/#how" className="nav-link-down">
          How it works <i className="arrow-down">↓</i>
        </a>
        <a href="/#examples" className="nav-link-down">
          Examples <i className="arrow-down">↓</i>
        </a>
        {onOpenContact && (
          <button type="button" className="nav-contact-btn" onClick={onOpenContact}>
            Contact
          </button>
        )}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title="Toggle Cinematic Dark / Paper Mode"
        >
          {theme === 'paper' ? '🌙 Dark' : '☀️ Paper'}
        </button>
      </span>

      <motion.a
        className="nav-upload-cta"
        href="/upload"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        Upload Chat <span className="arrow-up">↑</span>
      </motion.a>
    </nav>
  );
}



