/**
 * EvidenceDrawer
 * Shows real message receipts by looking up actual ChatMessages by ID.
 * If no message IDs are provided or found, renders nothing.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChatMessage } from '../../types/chat';

interface EvidenceDrawerProps {
  /** Message IDs to display as receipts */
  messageIds: string[];
  /** Lookup function from IntelligenceContext */
  getMessagesByIds: (ids: string[]) => ChatMessage[];
  /** Optional label for the toggle button */
  label?: string;
}

export function EvidenceDrawer({
  messageIds,
  getMessagesByIds,
  label = 'See the receipts',
}: EvidenceDrawerProps) {
  const [open, setOpen] = useState(false);

  // Only attempt lookup when the drawer is opened (lazy)
  const messages = open ? getMessagesByIds(messageIds) : [];

  // Don't render anything if there are no IDs to show
  if (!messageIds || messageIds.length === 0) return null;

  return (
    <div className="evidence">
      <button onClick={() => setOpen(!open)}>
        {label} <span>{open ? '−' : '+'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="messages"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {messages.length === 0 ? (
              <p style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.85rem' }}>
                No matching messages found in your chat.
              </p>
            ) : (
              messages.slice(0, 8).map((msg) => (
                <p key={msg.id}>
                  <b>{msg.sender ?? 'System'}</b>
                  {' '}{msg.text}
                  <small style={{ display: 'block', opacity: 0.45, fontSize: '0.75rem', marginTop: 2 }}>
                    {formatTimestamp(msg.timestamp)}
                  </small>
                </p>
              ))
            )}
            {messages.length > 8 && (
              <small style={{ opacity: 0.5 }}>
                +{messages.length - 8} more messages in this receipt.
              </small>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatTimestamp(ts: Date | string): string {
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
