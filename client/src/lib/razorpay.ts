import {
  CheckoutOptions,
  RazorpayOrderResponse,
  RazorpaySuccessResponse,
  RazorpayVerificationResponse,
} from '../types/razorpay';

/**
 * Get public Razorpay Key ID from Vite environment.
 */
export function getRazorpayKeyId(): string {
  const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!keyId) {
    console.warn('[Razorpay] VITE_RAZORPAY_KEY_ID is not configured in client environment.');
  }
  return keyId || '';
}

/**
 * Backend API Step 1: Create a Razorpay order.
 */
export async function createOrder(
  amountPaise: number,
  currency: string = 'INR',
  notes: Record<string, string> = {}
): Promise<RazorpayOrderResponse> {
  if (amountPaise < 100) {
    throw new Error('Minimum order amount is 100 paise (₹1).');
  }

  let response: Response;
  try {
    response = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        notes,
      }),
    });
  } catch (netErr: any) {
    throw new Error(
      'Could not reach the backend server. Make sure "node index.js" is running on port 3001.'
    );
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Backend server returned an invalid response (HTTP ${response.status}). Ensure the server is running on port 3001.`
    );
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Failed to create order: HTTP ${response.status}`);
  }

  return data;
}

/**
 * Backend API Step 3: Verify the payment signature.
 */
export async function verifyPayment(
  paymentData: RazorpaySuccessResponse
): Promise<RazorpayVerificationResponse> {
  let response: Response;
  try {
    response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData),
    });
  } catch (netErr: any) {
    throw new Error(
      'Could not reach the backend server to verify payment. Ensure "node index.js" is running on port 3001.'
    );
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Payment verification endpoint returned an invalid response (HTTP ${response.status}).`
    );
  }

  if (!response.ok || !data?.success || !data?.verified) {
    throw new Error(data?.error || 'Payment signature verification failed.');
  }

  return data;
}

/**
 * Helper to ensure Razorpay checkout script is loaded in window.
 */
export function isRazorpayLoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.Razorpay === 'function';
}

/**
 * Frontend Step 2: Open Razorpay Standard Checkout Modal.
 */
export async function openRazorpayCheckout(options: CheckoutOptions): Promise<void> {
  if (!isRazorpayLoaded()) {
    const errorMsg = 'Razorpay SDK is not loaded. Please ensure checkout.js is available or check your internet connection.';
    console.error(`[Razorpay] ${errorMsg}`);
    options.onError?.(new Error(errorMsg));
    return;
  }

  const keyId = getRazorpayKeyId();
  if (!keyId) {
    const errorMsg = 'Razorpay Key ID is missing. Add VITE_RAZORPAY_KEY_ID to client/.env';
    console.error(`[Razorpay] ${errorMsg}`);
    options.onError?.(new Error(errorMsg));
    return;
  }

  try {
    // 1. Create order on the server
    const order = await createOrder(options.amount, options.currency || 'INR', options.notes);

    // 2. Configure Razorpay modal options
    const rzpOptions = {
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: options.name || 'Afterchat AI',
      description: options.description || 'WhatsApp Conversation Intelligence Report',
      image: '/favicon.svg',
      order_id: order.order_id,
      prefill: options.prefill || {
        name: '',
        email: '',
        contact: '',
      },
      notes: options.notes || {},
      theme: {
        color: options.theme?.color || '#00E5FF',
      },
      handler: async (response: RazorpaySuccessResponse) => {
        try {
          // 3. Verify signature on backend & trigger email dispatch
          const userEmail = options.prefill?.email || options.notes?.email;
          const verificationResult = await verifyPayment({
            ...response,
            email: userEmail,
          } as any);
          options.onSuccess?.(verificationResult);
        } catch (err: any) {
          console.error('[Razorpay] Verification error:', err);
          options.onError?.(err);
        }
      },
      modal: {
        ondismiss: () => {
          console.log('[Razorpay] Checkout modal dismissed by user.');
          options.onDismiss?.();
        },
      },
    };

    const rzp = new window.Razorpay(rzpOptions);

    // Listen for payment failure event
    rzp.on('payment.failed', (response: any) => {
      console.error('[Razorpay] Payment failed event:', response.error);
      const failReason = response.error?.description || response.error?.reason || 'Payment failed';
      options.onError?.(new Error(failReason));
    });

    // 4. Open checkout modal
    rzp.open();
  } catch (err: any) {
    console.error('[Razorpay] Checkout initiation error:', err);
    options.onError?.(err);
  }
}
