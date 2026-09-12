/**
 * Secure storage abstraction for credentials.
 *
 * The browser build uses `localStorage` wrapped in an obfuscating transform so
 * long-lived credentials are not readable as plaintext from DevTools. Native
 * builds (Expo SecureStore, Capacitor, Electron keychain) should swap in their
 * platform store via `setSecureStorage` — the rest of the codebase only ever
 * talks to the `SecureStorage` interface, so the swap is invisible to callers.
 */

/**
 * @typedef {Object} SecureStorage
 * @property {boolean} available - true when this adapter can actually persist.
 * @property {(key: string) => string|null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

/** Fallback used during server-side rendering (never persists). */
export function createMemoryStorage() {
  const map = new Map();
  return {
    available: false,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

export function createLocalStorage() {
  return {
    get available() {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    },
    getItem(key) {
      if (this.available) return window.localStorage.getItem(key);
      return null;
    },
    setItem(key, value) {
      if (this.available) window.localStorage.setItem(key, value);
    },
    removeItem(key) {
      if (this.available) window.localStorage.removeItem(key);
    },
  };
}

/**
 * Example native adapter for Expo/Capacitor shells. Swap the body for
 * SecureStore/Keychain calls and pass it to `setSecureStorage` at boostrap:
 *
 * ```js
 * import { setSecureStorage } from '@/lib/secureStorage';
 * setSecureStorage(createNativeSecureStore());
 * ```
 */
export function createNativeSecureStoreHint() {
  return createMemoryStorage();
}

/**
 * XOR-rotates a base64-encoded payload with a constant key. This is NOT
 * encryption — it stops credentials from being trivially greppable in devtools
 * while keeping the module dependency-free. On native, prefer the OS keychain.
 */
const OB_KEY = 'luna::credential';

function obfuscate(payload) {
  const token = payload.split('').map((ch) => String.fromCharCode(ch.charCodeAt(0) + OB_KEY.length)).join('');
  return btoa(token);
}

function deobfuscate(payload) {
  const token = atob(payload);
  return token.split('').map((ch) => String.fromCharCode(ch.charCodeAt(0) - OB_KEY.length)).join('');
}

/**
 * Wraps any storage adapter so secrets are obscured at rest.
 * @param {SecureStorage} storage
 * @returns {SecureStorage}
 */
export function createObfuscatedStorage(storage) {
  return {
    get available() {
      return storage.available;
    },
    getItem(key) {
      const raw = storage.getItem(key);
      if (!raw) return null;
      try {
        return deobfuscate(raw);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      storage.setItem(key, obfuscate(value));
    },
    removeItem(key) {
      storage.removeItem(key);
    },
  };
}

// ---------------------------------------------------------------------------
// Registry — module-level singletons that hooks and UI read.
// ---------------------------------------------------------------------------

let metadataStorage = null;
let secretStorage = null;

/** Plain adapter for non-sensitive metadata (profiles, prefs, read offsets). */
export function getMetadataStorage() {
  if (!metadataStorage) metadataStorage = createLocalStorage();
  return metadataStorage;
}

/** Obfuscated adapter for credentials (refresh tokens, OTP nonces). */
export function getSecretStorage() {
  if (!secretStorage) secretStorage = createObfuscatedStorage(getMetadataStorage());
  return secretStorage;
}

/**
 * Inject platform storage (native keychain / SecureStore) at boostrap.
 * @param {SecureStorage} storage
 * @param {'metadata'|'secret'} [kind]
 */
export function setSecureStorage(storage, kind = 'secret') {
  if (kind === 'metadata') metadataStorage = storage;
  else secretStorage = storage;
}

/** JSON-safe read for metadata blobs. */
export function readJSON(storage, key) {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJSON(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}