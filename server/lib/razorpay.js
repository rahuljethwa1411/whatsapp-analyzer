import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance = null;

/**
 * Get or initialize the Razorpay SDK instance.
 */
export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret || keyId === 'your_key_id_here') {
    throw new Error('Razorpay credentials are not configured in environment variables.');
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
}

/**
 * Create a new Razorpay order.
 *
 * @param {Object} params
 * @param {number} params.amount - Amount in paise (minimum 100 paise = 1 INR)
 * @param {string} [params.currency='INR'] - Currency code
 * @param {string} [params.receipt] - Unique receipt ID
 * @param {Object} [params.notes] - Custom notes metadata
 * @returns {Promise<Object>} Created order details { order_id, amount, currency, ... }
 */
export async function createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  if (!amount || typeof amount !== 'number' || amount < 100) {
    const err = new Error('Amount is required and must be at least 100 paise (1 INR).');
    err.status = 400;
    throw err;
  }

  const client = getRazorpayClient();
  const options = {
    amount: Math.round(amount),
    currency: currency.toUpperCase(),
    receipt: receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    notes,
  };

  try {
    const order = await client.orders.create(options);
    return {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      created_at: order.created_at,
    };
  } catch (err) {
    console.error('[Razorpay] Order creation failed:', err);
    const errorObj = new Error(err.error?.description || err.message || 'Failed to create Razorpay order');
    errorObj.status = err.statusCode || (err.error?.code === 'BAD_REQUEST_ERROR' ? 400 : 500);
    if (err.statusCode === 401 || err.error?.code === 'UNAUTHORIZED_ERROR') {
      errorObj.status = 401;
    }
    throw errorObj;
  }
}

/**
 * Verify Razorpay payment signature using HMAC SHA256.
 *
 * @param {Object} params
 * @param {string} params.razorpay_order_id
 * @param {string} params.razorpay_payment_id
 * @param {string} params.razorpay_signature
 * @returns {{ verified: boolean, message: string }}
 */
export function verifyRazorpaySignature({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    const err = new Error('Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.');
    err.status = 400;
    throw err;
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    const err = new Error('RAZORPAY_KEY_SECRET is not configured on the server.');
    err.status = 500;
    throw err;
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body.toString())
    .digest('hex');

  const isValid = expectedSignature === razorpay_signature;

  return {
    verified: isValid,
    message: isValid
      ? 'Payment verified successfully.'
      : 'Payment verification failed: signature mismatch.',
  };
}
