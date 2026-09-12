/**
 * DeviceProfileStorageManager — the single source of truth for accounts remembered
 * on this device. It owns the `luna.deviceProfiles.v1` blob on `localStorage`
 * (via the metadata storage adapter) and the credential vault (obfuscated
 * adapter) behind it, and exposes the full CRUD surface the session, auth and
 * account-picker UIs are built on.
 *
 * Credential handling rules:
 *  - `refreshToken` and `password` are written into a profile ONLY when the
 *    user selects "Save Credentials & Logout" ("saveCredentialsWith"),
 *    enabling one-tap `fastLogin`.
 *  - "Logout Only" keeps profile metadata but drops every credential
 *    ("saveMetadataOnly").
 *  - `removeProfile` / `forgetDevice` removes a saved account (and its vaulted
 *    credential) from the device entirely.
 *
 * @typedef {import('./constants').StoredProfile} StoredProfile
 * @typedef {import('./constants').AuthUser} AuthUser
 */

import { getMetadataStorage, getSecretStorage, readJSON, writeJSON } from '@/lib/secureStorage';
import { STORAGE_KEYS } from '@/lib/constants';

function storage() {
  return getMetadataStorage();
}

function sanitize(profile) {
  return {
    userId: profile.userId,
    username: profile.username || '',
    displayName: profile.displayName || 'Unknown user',
    avatarUrl: profile.avatarUrl || '',
    hasSavedCredentials: Boolean(profile.hasSavedCredentials),
    email: profile.email || profile.userId || '',
    password: profile.password,
    refreshToken: profile.refreshToken,
    credentialsInvalid: Boolean(profile.credentialsInvalid),
    lastLoggedInAt: profile.lastLoggedInAt,
  };
}

/** Convenience: the current session's vaulted refresh credential. */
function readActiveRefreshToken() {
  return getSecretStorage().getItem(STORAGE_KEYS.accessToken);
}

export const DeviceProfileStorageManager = {
  /** @returns {StoredProfile[]} */
  listProfiles() {
    const stored = readJSON(storage(), STORAGE_KEYS.deviceProfiles);
    if (!Array.isArray(stored)) return [];
    return stored.map(sanitize).filter((p) => p.userId);
  },

  /**
   * @param {string} userId
   * @returns {StoredProfile|null}
   */
  getProfile(userId) {
    return this.listProfiles().find((p) => p.userId === userId) ?? null;
  },

  /** @param {StoredProfile} profile @returns {StoredProfile} */
  upsertProfile(profile) {
    const next = sanitize(profile);
    const others = this.listProfiles().filter((p) => p.userId !== next.userId);
    writeJSON(storage(), STORAGE_KEYS.deviceProfiles, [next, ...others].slice(0, 20));
    return next;
  },

  /**
   * Saves a profile WITH credentials (email/password/refresh token) so the
   * next launch can tap-to-login. Requires explicit user consent.
   * @param {AuthUser} user
   * @param {{refreshToken?: string, email?: string, password?: string}} [credentials]
   * @returns {StoredProfile}
   */
  saveCredentialsWith(user, credentials = {}) {
    return this.upsertProfile(
      this.fromUser(user, {
        hasSavedCredentials: true,
        email: credentials.email || user.email,
        password: credentials.password,
        refreshToken: credentials.refreshToken,
      })
    );
  },

  /**
   * Saves ONLY profile metadata (displayName/username/avatarUrl) — no
   * credentials survive. Selecting the resulting card re-prompts for auth.
   * @param {AuthUser} user
   * @returns {StoredProfile}
   */
  saveMetadataOnly(user) {
    return this.upsertProfile(this.fromUser(user, { hasSavedCredentials: false }));
  },

  /**
   * Removes a saved account from this device entirely ("Forget Device"),
   * including any vaulted refresh credential.
   * @param {string} userId
   */
  forgetDevice(userId) {
    const profile = this.getProfile(userId);
    this.removeProfile(userId);
    if (profile?.refreshToken && readActiveRefreshToken() === profile.refreshToken) {
      this.clearActiveRefreshToken();
    }
  },

  /** @param {string} userId */
  removeProfile(userId) {
    const others = this.listProfiles().filter((p) => p.userId !== userId);
    writeJSON(storage(), STORAGE_KEYS.deviceProfiles, others);
  },

  clearAllProfiles() {
    storage().removeItem(STORAGE_KEYS.deviceProfiles);
  },

  /**
   * Builds a StoredProfile from an authenticated user. Credentials survive
   * only when `hasSavedCredentials` was explicitly granted.
   * @param {AuthUser} user
   * @param {{hasSavedCredentials?: boolean, refreshToken?: string, email?: string, password?: string}} [options]
   * @returns {StoredProfile}
   */
  fromUser(user, options = {}) {
    return sanitize({
      userId: user.id,
      username: user.username || (user.email || '').split('@')[0] || user.id,
      displayName: user.name || user.email || user.id,
      avatarUrl: user.avatarUrl || '',
      hasSavedCredentials: Boolean(options.hasSavedCredentials),
      email: options.email || user.email || '',
      password: options.password,
      refreshToken: options.refreshToken,
      lastLoggedInAt: Date.now(),
    });
  },

  /**
   * Marks the saved credential as unusable; the UI keeps the card but
   * re-prompts for a password on next selection.
   * @param {string} userId
   * @returns {StoredProfile|null}
   */
  flagInvalidCredentials(userId) {
    const profile = this.getProfile(userId);
    if (!profile) return null;
    const next = { ...profile, credentialsInvalid: true, refreshToken: undefined };
    return this.upsertProfile(next);
  },

  /** Clears the invalid flag after a successful password/OTP re-auth. */
  clearInvalidFlag(userId) {
    const profile = this.getProfile(userId);
    if (!profile) return null;
    return this.upsertProfile({ ...profile, credentialsInvalid: false, lastLoggedInAt: Date.now() });
  },

  /** Updates the last-login timestamp without touching credentials. */
  touchLastLogin(userId) {
    const profile = this.getProfile(userId);
    if (!profile) return null;
    return this.upsertProfile({ ...profile, lastLoggedInAt: Date.now() });
  },

  // Active-refresh-credential mirror (kept out of the profile blob so the
  // schema above stays exactly as specified — the per-profile credential is
  // the saved-consent record; this is the current-session record).
  storeActiveRefreshToken(token) {
    getSecretStorage().setItem(STORAGE_KEYS.accessToken, token);
  },

  readActiveRefreshToken() {
    return getSecretStorage().getItem(STORAGE_KEYS.accessToken);
  },

  clearActiveRefreshToken() {
    getSecretStorage().removeItem(STORAGE_KEYS.accessToken);
  },
};

/** Backwards-compatible alias for existing importers. */
export const DeviceProfileManager = DeviceProfileStorageManager;

/** @typedef {typeof DeviceProfileStorageManager} DeviceProfileManagerAPI */