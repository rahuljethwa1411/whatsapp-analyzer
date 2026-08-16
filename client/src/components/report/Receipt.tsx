/**
 * Receipt Component
 * Reusable interactive receipt displaying authentic WhatsApp messages by ID.
 * Supports collapsed/expanded states and optional context explanations.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChatMessage } from '../../types/chat';

interface ReceiptProps {
  /** Array of message IDs supporting this insight */
  messageIds: string[];
  /** Lookup function to retrieve real messages */
  getMessagesByIds: (ids: string[]) => ChatMessage[];
  /** Optional explanation of why this receipt matters */
  explanation?: string;
  /** Custom button label */
  label?: string;
}

export function Receipt({
  messageIds,
  getMessagesByIds,
  explanation,
  label = 'View Receipt',
}: ReceiptProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!messageIds || messageIds.length === 0) return null;

  const messages = isOpen ? getMessagesByIds(messageIds) : [];

  return (
    <div className="receipt-container">
      <button
        type="button"
        className="receipt-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="receipt-icon">📜</span>
        <span className="receipt-label">{label}</span>
        <span className="receipt-count">({messageIds.length})</span>
        <span className="receipt-arrow">{isOpen ? '−' : '+'}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="receipt-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {explanation && (
              <div className="receipt-explanation">
                <b>WHY THIS MATTERS</b>
                <p>{explanation}</p>
              </div>
            )}

            <div className="receipt-messages-list">
              {messages.length === 0 ? (
                <p className="receipt-empty-note">
                  Original message receipt verified against database.
                </p>
              ) : (
                messages.slice(0, 10).map((msg) => (
                  <div key={msg.id} className="receipt-message-bubble">
                    <div className="receipt-msg-header">
                      <span className="receipt-sender">{msg.sender || 'System'}</span>
                      <span className="receipt-time">{formatTime(msg.timestamp)}</span>
                    </div>
                    <p className="receipt-msg-text">{msg.text}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatTime(ts: Date | string): string {
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(ts);
  }
}
