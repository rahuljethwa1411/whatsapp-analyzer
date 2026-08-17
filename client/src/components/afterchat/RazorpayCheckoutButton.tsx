import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { openRazorpayCheckout } from '../../lib/razorpay';
import { RazorpayVerificationResponse } from '../../types/razorpay';

interface RazorpayCheckoutButtonProps {
  amountPaise?: number; // e.g. 54900 = ₹549
  planName?: string;
  description?: string;
  buttonText?: string;
  className?: string;
  onPaymentSuccess?: (response: RazorpayVerificationResponse) => void;
  onPaymentError?: (error: Error | string) => void;
}

export function RazorpayCheckoutButton({
  amountPaise = 54900,
  planName = 'Afterchat Full 6-Page Intelligence Dossier',
  description = 'Complete Uncensored WhatsApp Conversation Intelligence Report',
  buttonText,
  className = '',
  onPaymentSuccess,
  onPaymentError,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [verifiedPaymentId, setVerifiedPaymentId] = useState<string | null>(null);

  const amountRupees = Math.round(amountPaise / 100);

  const handleCheckout = async () => {
    setLoading(true);
    setPaymentStatus('processing');
    setStatusMessage('Connecting to Razorpay secure gateway...');

    await openRazorpayCheckout({
      amount: amountPaise,
      currency: 'INR',
      name: 'Afterchat AI',
      description: `${planName} (₹${amountRupees})`,
      theme: {
        color: '#cc513d',
      },
      onSuccess: (response) => {
        setLoading(false);
        setPaymentStatus('success');
        setVerifiedPaymentId(response.payment_id || null);
        setStatusMessage('Payment verified successfully! Full dossier unlocked.');
        if (onPaymentSuccess) {
          onPaymentSuccess(response);
        }
      },
      onError: (err) => {
        setLoading(false);
        setPaymentStatus('error');
        const msg = typeof err === 'string' ? err : err.message || 'Payment processing failed';
        setStatusMessage(msg);
        if (onPaymentError) {
          onPaymentError(err);
        }
      },
      onDismiss: () => {
        setLoading(false);
        setPaymentStatus('idle');
        setStatusMessage('Payment cancelled by user.');
      },
    });
  };

  return (
    <div className="razorpay-checkout-container" style={{ display: 'inline-flex', flexDirection: 'column', gap: '8px' }}>
      <motion.button
        type="button"
        className={`button razorpay-pay-btn ${className}`}
        onClick={handleCheckout}
        disabled={loading}
        whileHover={{ scale: loading ? 1 : 1.02 }}
        whileTap={{ scale: loading ? 1 : 0.98 }}
        style={{
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.8 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        {loading ? (
          <>
            <span
              style={{
                display: 'inline-block',
                width: '14px',
                height: '14px',
                border: '2px solid currentColor',
                borderRightColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.75s linear infinite',
              }}
            />
            <span>Initializing Razorpay...</span>
          </>
        ) : (
          <>
            <span>{buttonText || `Pay with Razorpay (₹${amountRupees})`}</span>
            <span style={{ fontSize: '1.1em' }}>💳</span>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {statusMessage && paymentStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              padding: '6px 10px',
              borderRadius: '4px',
              background:
                paymentStatus === 'success'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : paymentStatus === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(204, 81, 61, 0.1)',
              color:
                paymentStatus === 'success'
                  ? '#16a34a'
                  : paymentStatus === 'error'
                  ? '#dc2626'
                  : 'var(--ink)',
              border: `1px solid ${
                paymentStatus === 'success'
                  ? '#86efac'
                  : paymentStatus === 'error'
                  ? '#fca5a5'
                  : 'var(--line)'
              }`,
            }}
          >
            {statusMessage}
            {verifiedPaymentId && (
              <div style={{ marginTop: '2px', opacity: 0.85 }}>
                Payment ID: <code>{verifiedPaymentId}</code>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
