/**
 * OTP (one-time passcode) authentication — the frictionless sign-in/sign-up
 * path. The server logs the 6-digit code until a mail provider is wired up in
 * exactly the same way the password-reset code does.
 *
 * @typedef {import('./constants').AuthSession} AuthSession
 * @typedef {import('./constants').AuthSuccessPayload} AuthSuccessPayload
 */

import { persistAuthSession, SessionError } from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new SessionError('Could not reach the Luna server. Please make sure it is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new SessionError(data.message || 'Something went wrong. Please try again.', {
      status: res.status,
      fieldErrors: data.fieldErrors || {},
    });
  }
  return data;
}

/**
 * @typedef {Object} OtpRequestOutcome
 * @property {string} message
 * @property {number} expiresInSeconds
 */

/**
 * Requests a passcode be sent to `email`. Safe to call repeatedly.
 * @param {string} email
 * @returns {Promise<OtpRequestOutcome>}
 */
export async function requestOtp(email) {
  return post('/api/auth/otp/request', { email });
}

/**
 * Exchanges a passcode for a full session. Creates an account automatically
 * for brand-new emails (sign-up via OTP). Returns `isNewUser` so the caller
 * can route first-timers to onboarding.
 * @param {string} email
 * @param {string} code
 * @returns {Promise<{session: AuthSession, isNewUser: boolean}>}
 */
export async function verifyOtp(email, code) {
  /** @type {AuthSuccessPayload} */
  const payload = await post('/api/auth/otp/verify', { email, code });
  const session = persistAuthSession(payload);
  return { session, isNewUser: Boolean(payload.isNewUser) };
}