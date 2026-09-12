'use client';

import { useCallback, useEffect, useState } from 'react';
import { DeviceProfileManager } from '@/lib/deviceProfileStorageManager';
import {
  fastAuthLogin,
  getAccessToken,
  getCurrentUser,
  logoutUser as logoutUserCore,
  persistAuthSession,
  purgeSession,
  SessionError,
} from '@/lib/session';
import { AUTH_EVENTS } from '@/lib/constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function restoreFromMemory() {
  const token = getAccessToken();
  const user = getCurrentUser();
  if (!token || !user) return null;
  const profile = user ? DeviceProfileManager.getProfile(user.id) : null;
  return { user, tokens: { accessToken: token, refreshToken: profile?.refreshToken ?? '' } };
}

async function post(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
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
 * The single session hook used by the dashboard, the account picker and the
 * fast-auth screen. Owns the active AuthSession + the current device profile,
 * reacts to unauthorized / session-cleared events, and exposes logout.
 *
 * @return {{
 *   session: import('@/lib/constants').AuthSession|null,
 *   profile: import('@/lib/constants').StoredProfile|null,
 *   busy: boolean,
 *   error: string|null,
 *   restore: () => import('@/lib/constants').AuthSession|null,
 *   loginWithPayload: (p: import('@/lib/constants').AuthSuccessPayload) => import('@/lib/constants').AuthSession,
 *   loginWithOtp: (email: string, code: string) => Promise<{session: import('@/lib/constants').AuthSession, isNewUser: boolean}>,
 *   fastAuth: (profile: import('@/lib/constants').StoredProfile) => Promise<import('@/lib/constants').AuthSession>,
 *   logout: (saveCredentials: boolean) => Promise<import('@/lib/session').LogoutResult>,
 *   clear: () => void,
 * }}
 */
export function useSession() {
  const [session, setSession] = useState(() => restoreFromMemory());
  const [profile, setProfile] = useState(() =>
    session ? DeviceProfileManager.getProfile(session.user.id) : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const clear = () => {
      setSession(null);
      setProfile(null);
      setError(null);
    };
    window.addEventListener(AUTH_EVENTS.sessionCleared, clear);
    window.addEventListener(AUTH_EVENTS.unauthorized, clear);
    return () => {
      window.removeEventListener(AUTH_EVENTS.sessionCleared, clear);
      window.removeEventListener(AUTH_EVENTS.unauthorized, clear);
    };
  }, []);

  const commit = useCallback((payload) => {
    const s = persistAuthSession(payload);
    setSession(s);
    setProfile(DeviceProfileManager.getProfile(s.user.id));
    return s;
  }, []);

  /** Reset timeline: if the tab already has a live session, restore it. */
  const restore = useCallback(() => {
    const s = restoreFromMemory();
    setSession(s);
    setProfile(s ? DeviceProfileManager.getProfile(s.user.id) : null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_EVENTS.sessionRestored));
    }
    return s;
  }, []);

  /** Standard (password / Google) sign-in after the server returns. */
  const loginWithPayload = useCallback((payload) => commit(payload), [commit]);

  /** Tap-to-login using the profile's saved refresh credential. */
  const fastAuth = useCallback(async (target) => {
    setBusy(true);
    setError(null);
    try {
      const s = await fastAuthLogin(target);
      setSession(s);
      setProfile(DeviceProfileManager.getProfile(s.user.id));
      return s;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  /** One-shot OTP exchange (email + code) with auto sign-up for new emails. */
  const loginWithOtp = useCallback(
    async (email, code) => {
      setBusy(true);
      setError(null);
      try {
        const payload = await post('/api/auth/otp/verify', { email, code });
        const s = commit(payload);
        return { session: s, isNewUser: Boolean(payload.isNewUser) };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'OTP verification failed.');
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [commit]
  );

  /**
   * Logout with the credential-persistence decision the LogoutModal
   * asks for. `saveCredentials=true` vaults the refresh token on the device
   * profile; `false` keeps only metadata and purges everything sensitive.
   */
  const logout = useCallback(async (saveCredentials) => {
    setBusy(true);
    try {
      const result = await logoutUserCore(saveCredentials);
      setSession(null);
      setProfile(result.profile);
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  const clear = useCallback(() => {
    purgeSession();
    setSession(null);
    setProfile(null);
  }, []);

  return { session, profile, busy, error, restore, loginWithPayload, loginWithOtp, fastAuth, logout, clear };
}

/** @typedef {ReturnType<typeof useSession>} SessionHook */