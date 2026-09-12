/**
 * Contact discovery fallbacks. Contract sync is the primary path; when it is
 * unavailable (no permission, no native bridge, no backend match) the UI falls
 * back through: username search, QR code, and direct share links. Each function
 * resolves gracefully instead of throwing.
 *
 * @typedef {import('./constants').AuthUser} AuthUser
 */

import { isPermissionSupported } from '@/lib/permissions';
import { SessionError } from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * @typedef {'sync'|'username'|'qr'|'link'} DiscoveryMethod
 * @typedef {Object} DiscoveryCapabilities
 * @property {DiscoveryMethod[]} methods
 * @property {boolean} syncSupported
 * @property {boolean} qrSupported
 * @property {boolean} linkSupported
 */

export function getDiscoveryCapabilities() {
  const qrSupported =
    !(typeof document === 'undefined') &&
    typeof document.createElement === 'function' &&
    'toDataURL' in document.createElement('canvas');
  return { methods: ['sync', 'username', 'qr', 'link'], syncSupported: true, qrSupported, linkSupported: true };
}

// ---------------------------------------------------------------------------
// Contact sync.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ContactRecord
 * @property {string} name
 * @property {string|undefined} [phone]
 * @property {string|undefined} [email]
 */

/** @typedef {() => Promise<ContactRecord[]>} ContactProvider */

/**
 * Syncs the device address book through a native bridge when one is injected.
 * @param {ContactProvider} [provider] native contact provider (mobile only)
 * @returns {Promise<ContactRecord[]>}
 */
export async function syncContacts(provider = null) {
  if (!provider) return [];
  if (!isPermissionSupported('microphone')) return [];
  return provider();
}

/**
 * Request-contact-sync entry point. The browser shell intentionally has no
 * contact store, so it falls back instantly; the EmptyStateChat UI then offers
 * username search / QR / share-link discovery instead.
 * @returns {Promise<{count: number, method: 'sync'}>}
 */
export async function requestContactSync() {
  return { count: 0, method: 'sync' };
}

// ---------------------------------------------------------------------------
// Username search (backend: GET /api/users/search?q=).
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} UsernameSearchResult
 * @property {AuthUser[]} users
 * @property {string} query
 */

/** @param {string} query @returns {Promise<UsernameSearchResult>} */
export async function searchByUsername(query) {
  const q = (query || '').trim();
  if (!q) return { users: [], query: q };

  let res;
  try {
    res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(q)}`);
  } catch {
    throw new SessionError('Could not reach the Luna server. Please make sure it is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.users)) {
    return { users: [], query: q };
  }
  return { users: data.users, query: q };
}

// ---------------------------------------------------------------------------
// Direct share links.
// ---------------------------------------------------------------------------

/**
 * Builds a copyable/pasteable invite link for a username, e.g.
 * https://luna.app/i/amelia?ref=share.
 * @param {string} username
 * @returns {string}
 */
export function buildShareLink(username) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://luna.app';
  return `${origin}/i/${encodeURIComponent(username)}?ref=share`;
}

/**
 * @typedef {Object} ShareLinkPayload
 * @property {string} username
 * @property {'share'|'qr'} source
 */

/** @param {string} url @returns {ShareLinkPayload|null} */
export function parseShareLink(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const username = segments[segments.length - 1] ?? '';
    if (!username) return null;
    return { username, source: parsed.searchParams.get('ref') === 'qr' ? 'qr' : 'share' };
  } catch {
    return null;
  }
}

/** @returns {ShareLinkPayload|null} */
export function readShareLinkFromQuery() {
  if (typeof window === 'undefined') return null;
  return parseShareLink(window.location.href);
}

// ---------------------------------------------------------------------------
// QR code.
// ---------------------------------------------------------------------------

const QR_PREFIX = 'luna://user/';

/**
 * @typedef {Object} QrPayload
 * @property {string} username
 * @property {string} userId
 */

/** @param {{username?: string, id: string}} user @returns {string} */
export function encodeQrPayload(user) {
  return `${QR_PREFIX}${encodeURIComponent(user.username || user.id)}/${user.id}`;
}

/** @param {string} raw @returns {QrPayload|null} */
export function decodeQrPayload(raw) {
  if (!raw.startsWith(QR_PREFIX)) return null;
  const [username, userId] = raw.slice(QR_PREFIX.length).split('/');
  if (!userId) return null;
  return { username: decodeURIComponent(username), userId };
}

/** @returns {boolean} */
export function canScanQr() {
  return isPermissionSupported('camera');
}

/**
 * Scans a QR containing a Luna user payload. The browser has no QR decoder
 * built in, so this resolves null unless a `scanner` is injected (real shells
 * pass their native QR module). Falls back to manual username entry.
 * @param {(stream: MediaStream) => Promise<string>} [scanner]
 * @returns {Promise<QrPayload|null>}
 */
export async function scanQr(scanner = null) {
  if (!isPermissionSupported('camera')) return null;
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  try {
    if (scanner) {
      const raw = await scanner(stream);
      return decodeQrPayload(raw);
    }
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
  return null;
}