import crypto from 'crypto';
import { verifyRazorpaySignature } from '../server/lib/razorpay.js';
import { sendReportEmail } from '../server/lib/mailer.js';

console.log('=== TEST: Razorpay Signature Verification & Mailer ===');

// Setup test secret
process.env.RAZORPAY_KEY_SECRET = 'test_secret_key_123';

const orderId = 'order_12345';
const paymentId = 'pay_67890';
const body = `${orderId}|${paymentId}`;

// Generate valid signature
const validSignature = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(body)
  .digest('hex');

// Test valid signature
const validResult = verifyRazorpaySignature({
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: validSignature,
});

console.log('Valid Signature Verification:', validResult.verified ? 'PASSED (Verified: true)' : 'FAILED');
if (!validResult.verified) {
  throw new Error('Expected valid signature to verify successfully');
}

// Test invalid signature
const invalidResult = verifyRazorpaySignature({
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: 'invalid_tampered_signature',
});

console.log('Invalid Signature Rejection:   ', !invalidResult.verified ? 'PASSED (Verified: false)' : 'FAILED');
if (invalidResult.verified) {
  throw new Error('Expected invalid signature to be rejected');
}

// Test Mailer validation
const invalidMailResult = await sendReportEmail({
  to: 'invalid-email-string',
  participants: 'Rahul & Sam',
});
console.log('Mailer Invalid Email Handling: ', !invalidMailResult.success ? 'PASSED (Rejected invalid email)' : 'FAILED');

console.log('✓ Razorpay and Mailer modules verified successfully.');
