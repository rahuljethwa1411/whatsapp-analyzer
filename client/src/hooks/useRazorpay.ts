import { useCallback, useState } from 'react';
import type { CheckoutOptions, RazorpaySuccessResponse, RazorpayOrderResponse, RazorpayVerificationResponse } from '../types/razorpay';

export function useRazorpay() {
  const [isProcessing, setIsProcessing] = useState(false);

  const loadScript = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  const checkout = useCallback(async (options: CheckoutOptions) => {
    setIsProcessing(true);

    try {
      const res = await loadScript();
      if (!res) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // 1. Create order on backend
      const orderResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: options.amount,
          currency: options.currency || 'INR',
          notes: options.notes,
        }),
      });

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        throw new Error(`Failed to create order: ${errorText}`);
      }

      const orderData: RazorpayOrderResponse = await orderResponse.json();
      
      if (!orderData.success || !orderData.order_id) {
        throw new Error(orderData.error || 'Failed to create order. No order ID returned.');
      }

      // 2. Open Razorpay Checkout modal
      const razorpayOptions = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Use public key from env
        amount: orderData.amount,
        currency: orderData.currency,
        name: options.name || 'Afterchat.fun',
        description: options.description || 'Unlock Full Report',
        order_id: orderData.order_id,
        prefill: options.prefill,
        notes: options.notes,
        theme: options.theme || {
          color: '#e5ff00', // Afterchat theme color
        },
        handler: async function (response: RazorpaySuccessResponse) {
          try {
            // 3. Verify payment on backend
            const verifyResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData: RazorpayVerificationResponse = await verifyResponse.json();

            if (verifyData.success && verifyData.verified) {
              options.onSuccess?.(verifyData);
            } else {
              throw new Error(verifyData.error || 'Payment verification failed');
            }
          } catch (err: any) {
            options.onError?.(err.message || 'Payment verification failed');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
            options.onDismiss?.();
          },
        },
      };

      const rzp = new window.Razorpay(razorpayOptions);
      rzp.on('payment.failed', function (response: any) {
        options.onError?.(response.error.description || 'Payment failed');
        setIsProcessing(false);
      });

      rzp.open();
    } catch (err: any) {
      options.onError?.(err.message || 'An error occurred during checkout');
      setIsProcessing(false);
    }
  }, [loadScript]);

  return {
    checkout,
    isProcessing,
  };
}
