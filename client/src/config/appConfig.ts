/**
 * Central Application Configuration & Environment Management
 *
 * Switch between Local Dev Mode (all sections unlocked) and Production Mode (paywall enabled)
 * using VITE_UNLOCK_ALL in client/.env.
 */

export const APP_CONFIG = {
  // When true: bypasses the paywall completely so you can see all 10 chapters, eras, lore, etc. in local dev.
  // When false: enforces Razorpay payment preview paywall (production behavior).
  UNLOCK_ALL: import.meta.env.VITE_UNLOCK_ALL === 'true',

  // Razorpay Public Key ID (rzp_test_... for test mode, rzp_live_... for production)
  RAZORPAY_KEY_ID: import.meta.env.VITE_RAZORPAY_KEY_ID || '',

  // Pricing
  REPORT_PRICE_PAISE: 39900, // ₹399 in paise
  REPORT_PRICE_INR: 399,
  ORIGINAL_PRICE_INR: 799,

  // Helpers
  isTestMode: (): boolean => {
    const key = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
    return key.startsWith('rzp_test_');
  },
  isLiveMode: (): boolean => {
    const key = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
    return key.startsWith('rzp_live_');
  },
  isDev: import.meta.env.DEV,
};
