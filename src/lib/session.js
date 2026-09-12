/**
 * Session & credential lifecycle.
 *
 * Responsibilities:
 *  - persist/restore the active session (access token held in memory +
 *    sessionStorage, refresh credential in the saved profile's record).
 *  - refresh (rotate) access tokens before they expire.
 *  - `logoutUser(saveCredentials)` — the single logout entry point that
 *    evacuates state and decides whether credentials stay on this device.
 *
 * @typedef {import('./constants').AuthSuccessPayload} AuthSuccessPayload
 * @typedef {import('./constants').AuthSession} AuthSession
 * @typedef {import('./constants').AuthUser} AuthUser
 * @typedef {import('./constants').StoredProfile} StoredProfile
 * @typedef {import('./deviceProfileStorageManager').DeviceProfileManagerAPI} DeviceProfileManagerAPI
 */

import { DeviceProfileManager } from '@/lib/deviceProfileStorageManager';
import { getMetadataStorage, getSecretStorage } from '@/lib/secureStorage';
import { AUTH_EVENTS, STORAGE_KEYS } from '@/lib/constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Errors.
// ---------------------------------------------------------------------------

export class SessionError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'SessionError';
    this.status = options.status;
    this.fieldErrors = options.fieldErrors || {};
    this.code =
      options.status === 401 || options.status === 400
        ? 'invalid_credentials'
        : options.status === 404
          ? 'not_found'
          : options.status === undefined
            ? 'network'
            : 'server';
  }
}

// ---------------------------------------------------------------------------
// Low-level transport (avoids circular imports with src/lib/api.js).
// ---------------------------------------------------------------------------

async function authPost(path, body, token) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

// ---------------------------------------------------------------------------
// Active session storage (access token: memory -> sessionStorage).
// ---------------------------------------------------------------------------

let memoryAccessToken = null;
let memoryUser = null;

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

/** The short-lived access token of the active session. */
export function getAccessToken() {
  if (memoryAccessToken) return memoryAccessToken;
  if (canUseSessionStorage()) {
    const t = window.sessionStorage.getItem(STORAGE_KEYS.accessToken);
    if (t) return t;
  }
  // Backwards-compatible read for sessions persisted before this module.
  try {
    return getMetadataStorage().getItem(STORAGE_KEYS.legacyToken);
  } catch {
    return null;
  }
}

function setAccessToken(token) {
  memoryAccessToken = token;
  if (canUseSessionStorage()) {
    window.sessionStorage.setItem(STORAGE_KEYS.accessToken, token);
  }
  try {
    getMetadataStorage().setItem(STORAGE_KEYS.legacyToken, token);
  } catch {
    /* noop */
  }
}

function clearAccessToken() {
  memoryAccessToken = null;
  if (canUseSessionStorage()) {
    window.sessionStorage.removeItem(STORAGE_KEYS.accessToken);
  }
  try {
    getMetadataStorage().removeItem(STORAGE_KEYS.legacyToken);
  } catch {
    /* noop */
  }
}

/** The user object of the active session (mirrors the original luna_user). */
export function getCurrentUser() {
  if (memoryUser) return memoryUser;
  try {
    const raw = getMetadataStorage().getItem(STORAGE_KEYS.legacyUser);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  memoryUser = user;
  try {
    getMetadataStorage().setItem(STORAGE_KEYS.legacyUser, JSON.stringify(user));
  } catch {
    /* noop */
  }
}

function clearCurrentUser() {
  memoryUser = null;
  try {
    getMetadataStorage().removeItem(STORAGE_KEYS.legacyUser);
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// Remembered credentials (used by "Save Credentials & Logout").
// ---------------------------------------------------------------------------

/** Remembers the email/password used for the current password-based session. */
export function rememberPassword(email, password) {
  if (!email || !password) return;
  try {
    getSecretStorage().setItem(
      STORAGE_KEYS.password,
      JSON.stringify({ email, password })
    );
  } catch {
    /* noop */
  }
}

/** Clears the remembered credential (non-password auth, or logout without save). */
export function clearRememberedPassword() {
  try {
    getSecretStorage().removeItem(STORAGE_KEYS.password);
  } catch {
    /* noop */
  }
}

/** @returns {{email: string, password: string}|null} */
function getRememberedPassword() {
  try {
    const raw = getSecretStorage().getItem(STORAGE_KEYS.password);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Persisting / vaulting sessions.
// ---------------------------------------------------------------------------

/**
 * Called after ANY successful interactive auth (password, Google, OTP). Stores
 * the access/refresh pair, refreshes the local profile card, and clears any
 * previously-flagged invalid-credential state.
 * @param {AuthSuccessPayload} payload
 * @returns {AuthSession}
 */
export function persistAuthSession(payload) {
  setAccessToken(payload.token);
  setCurrentUser(payload.user);
  setActiveRefreshCredential(payload.refreshToken, payload.user);
  try {
    getMetadataStorage().setItem(STORAGE_KEYS.isNewUser, payload.isNewUser ? '1' : '0');
  } catch {
    /* noop */
  }
  return { user: payload.user, tokens: { accessToken: payload.token, refreshToken: payload.refreshToken } };
}

/**
 * The refresh credential of the CURRENT session is mirrored under the active
 * session record (so it survives a tab reload), while the per-profile token
 * follows explicit consent only: a card that previously opted into
 * "Save Credentials & Logout" keeps that credential rotated and up to date;
 * anyone else gets metadata + the active mirror but no vaulted credential.
 * @param {string} refreshToken
 * @param {AuthUser} user
 */
export function setActiveRefreshCredential(refreshToken, user) {
  const existing = DeviceProfileManager.getProfile(user.id);
  const consent = existing?.hasSavedCredentials === true;

  DeviceProfileManager.upsertProfile(
    DeviceProfileManager.fromUser(user, {
      hasSavedCredentials: consent,
      refreshToken: consent ? refreshToken : undefined,
      password: consent ? existing?.password : undefined,
    })
  );

  if (refreshToken) {
    DeviceProfileManager.storeActiveRefreshToken(refreshToken);
  } else {
    DeviceProfileManager.clearActiveRefreshToken();
  }
  DeviceProfileManager.clearInvalidFlag(user.id);
}

// ---------------------------------------------------------------------------
// Token refresh.
// ---------------------------------------------------------------------------

/** Fetches a fresh access token from the API using the given refresh token. */
async function refreshWith(refreshToken) {
  return authPost('/api/auth/refresh', { refreshToken });
}

/** Refresh-token lookup: current profile first, then the active mirror. */
function resolveAvailableRefreshToken() {
  const user = getCurrentUser();
  if (user?.id) {
    const profile = DeviceProfileManager.getProfile(user.id);
    if (profile?.refreshToken) return profile.refreshToken;
  }
  return DeviceProfileManager.readActiveRefreshToken();
}

/**
 * Rotates the current session's tokens. Used by the API layer after a 401.
 * Throws `SessionError` when the refresh credential is gone/invalid, which
 * callers surface as a re-auth requirement.
 * @returns {Promise<AuthSession>}
 */
export async function refreshAccessToken() {
  const refreshToken = resolveAvailableRefreshToken();
  if (!refreshToken) {
    throw new SessionError('Session expired. Please sign in again.', { status: 401 });
  }
  const payload = await refreshWith(refreshToken);
  return persistAuthSession(payload);
}

// ---------------------------------------------------------------------------
// Profile updates (avatar upload).
// ---------------------------------------------------------------------------

/**
 * Applies a new profile picture from the server to the active session and the
 * saved device profile, and notifies other mount sites (account picker) via
 * the profiles-changed event.
 * @param {AuthUser} updated - the user object returned by the API.
 * @returns {AuthUser}
 */
export function updateActiveAvatar(updated) {
  const nextUser = { ...(getCurrentUser() || {}), ...updated };
  setCurrentUser(nextUser);

  const profile = DeviceProfileManager.getProfile(nextUser.id);
  if (profile) {
    DeviceProfileManager.upsertProfile({ ...profile, avatarUrl: nextUser.avatarUrl || '' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('luna:profiles-changed'));
    }
  }
  return nextUser;
}

// ---------------------------------------------------------------------------
// Fast-auth ("Tap to Login as <Profile>").
// ---------------------------------------------------------------------------

/**
 * One-tap sign-in using a profile whose email+password were saved at logout
 * (direct credential sign-in). Accounts without a password (Google / OTP) fall
 * back to the saved refresh credential. On failure the profile card is kept
 * but flagged, so the UI can fall back to a password/OTP prompt without losing
 * the saved metadata.
 * @param {StoredProfile} profile
 * @returns {Promise<AuthSession>}
 */
export async function fastAuthLogin(profile) {
  const savedPassword = profile.email && profile.password;
  try {
    const payload = savedPassword
      ? await authPost('/api/auth/login', {
          email: profile.email,
          password: profile.password,
        })
      : profile.refreshToken
        ? await refreshWith(profile.refreshToken)
        : Promise.reject(
            new SessionError('No saved credentials for this account.', {
              status: 401,
            })
          );
    return persistAuthSession(payload);
  } catch (err) {
    DeviceProfileManager.flagInvalidCredentials(profile.userId);
    if (err instanceof SessionError && err.code === 'network') throw err;
    throw new SessionError(
      'Your saved sign-in has expired. Enter your password or a code to continue.',
      { status: 401 }
    );
  }
}

/**
 * Best-effort check whether a profile can still fast-auth. Non-destructive:
 * the rotation performed by /refresh is written back into the profile card so
 * the credential stays usable.
 * @param {StoredProfile} profile
 * @returns {Promise<boolean>}
 */
export async function validateSavedToken(profile) {
  if (!profile.refreshToken) return false;
  try {
    const payload = await refreshWith(profile.refreshToken);
    setActiveRefreshCredential(payload.refreshToken, payload.user);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Logout — the single "state evacuation + API revocation" entry point.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LogoutResult
 * @property {boolean} credentialsSaved - true when credentials were vaulted on this device.
 * @property {StoredProfile|null} profile - the profile card kept for this account.
 */

/**
 * Logs the current session out of every layer of the app:
 *  1. best-effort API-side revocation of the refresh credential,
 *  2. stores (or strips) credentials from the device profile per the user's
 *     choice at the prompt,
 *  3. purges active tokens / user state and notifies the UI.
 * @param {boolean} saveCredentials
 * @returns {Promise<LogoutResult>}
 */
export async function logoutUser(saveCredentials) {
  const user = getCurrentUser();
  const profile = user ? DeviceProfileManager.getProfile(user.id) : null;
  const refreshToken =
    profile?.refreshToken ?? DeviceProfileManager.readActiveRefreshToken() ?? undefined;

  // 1. Server-side revocation (best effort — never block logout on it).
  if (refreshToken) {
    try {
      await authPost('/api/auth/logout', { refreshToken }, getAccessToken() ?? undefined);
    } catch {
      /* Revocation is best-effort; local purge still proceeds. */
    }
  }

  // 2. Decide what this device keeps.
  let nextProfile = null;
  if (user) {
    if (saveCredentials) {
      // "Save Credentials & Logout" — keep the email/password (and the refresh
      // credential when one exists) so a tap on the profile signs straight in.
      const remembered = getRememberedPassword() || {};
      nextProfile = DeviceProfileManager.upsertProfile(
        DeviceProfileManager.fromUser(user, {
          email: remembered.email || user.email,
          password: remembered.password,
          refreshToken,
          hasSavedCredentials: true,
        })
      );
    } else {
      clearRememberedPassword();
      nextProfile = DeviceProfileManager.upsertProfile(
        DeviceProfileManager.fromUser(user, { hasSavedCredentials: false })
      );
    }
  }

  // 3. Evacuate active session state.
  clearAccessToken();
  clearCurrentUser();
  DeviceProfileManager.clearActiveRefreshToken();
  try {
    getMetadataStorage().removeItem(STORAGE_KEYS.isNewUser);
  } catch {
    /* noop */
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EVENTS.sessionCleared));
  }

  return { credentialsSaved: Boolean(saveCredentials && refreshToken), profile: nextProfile };
}

/** Hard purge used on unauthorized responses — nothing survives. */
export function purgeSession() {
  clearAccessToken();
  clearCurrentUser();
  DeviceProfileManager.clearActiveRefreshToken();
  try {
    getMetadataStorage().removeItem(STORAGE_KEYS.isNewUser);
  } catch {
    /* noop */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EVENTS.unauthorized));
  }
}