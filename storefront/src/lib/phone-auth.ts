import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { firebaseAuth } from './firebase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let confirmationResult: any = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;
let devTestPhone: string | null = null;

const PHONE_KEY = 'svn_phone';

function getFullPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('91') && digits.length === 12
    ? `+${digits}`
    : `+91${digits}`;
}

function clearVerifier() {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch { /* already gone */ }
    recaptchaVerifier = null;
  }
}

/**
 * Dev:  bypasses Firebase entirely — sendOTP returns immediately,
 *       verifyOTP accepts any 6-digit code. No reCAPTCHA or SMS.
 *
 * Prod: invisible reCAPTCHA fires silently — no checkbox shown.
 *       Requires reCAPTCHA Enterprise API enabled in Google Cloud Console
 *       for project srivani-store-b0c55.
 *
 * Throws a Firebase AuthError on production failure.
 */
export async function sendOTP(phone: string, containerId: string): Promise<void> {
  clearVerifier();

  if (process.env.NODE_ENV === 'development') {
    devTestPhone = phone;
    return;
  }

  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: 'invisible',
  });

  try {
    confirmationResult = await signInWithPhoneNumber(
      firebaseAuth,
      getFullPhone(phone),
      recaptchaVerifier,
    );
  } catch (e) {
    clearVerifier();
    throw e;
  }
}

export async function verifyOTP(otp: string): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    if (!devTestPhone) throw new Error('No OTP pending — please click Send OTP again');
    const phone = devTestPhone;
    devTestPhone = null;
    localStorage.setItem(PHONE_KEY, phone);
    return phone;
  }

  if (!confirmationResult) throw new Error('No OTP pending — please click Send OTP again');
  const result = await confirmationResult.confirm(otp);
  const phone = result.user.phoneNumber ?? '';
  const local = phone.replace(/^\+91/, '');
  localStorage.setItem(PHONE_KEY, local);
  clearVerifier();
  return local;
}

export function resetOTP(): void {
  confirmationResult = null;
  devTestPhone = null;
  clearVerifier();
}

export function getVerifiedPhone(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PHONE_KEY);
}

export function clearVerifiedPhone(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(PHONE_KEY);
}
