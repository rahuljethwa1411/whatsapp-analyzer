export interface RazorpayOrderResponse {
  success: boolean;
  order_id: string;
  amount: number;
  currency: string;
  receipt?: string;
  key_id?: string;
  error?: string;
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayVerificationResponse {
  success: boolean;
  verified: boolean;
  message?: string;
  error?: string;
  payment_id?: string;
  order_id?: string;
}

export interface CheckoutOptions {
  amount: number; // in paise, minimum 100 paise
  currency?: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  reportSnapshot?: any;
  onSuccess?: (response: RazorpayVerificationResponse) => void;
  onError?: (error: Error | string) => void;
  onDismiss?: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}
