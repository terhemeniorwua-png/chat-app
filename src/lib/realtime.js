/**
 * Singleton Socket.IO client for the Luna realtime layer.
 *
 * Responsibility:
 *   - maintain a single authenticated WebSocket connection to the API server,
 *   - transparently refresh an expired access token and reconnect on the first
 *     auth failure (mirrors the REST layer's one-rotate-then-die behaviour),
 *   - provide a thin on/off wrapper so React components never hold raw socket
 *     references or leak listeners between re-renders.
 *
 * The backend is a persistent host, so the socket URL can differ from the REST
 * API URL. NEXT_PUBLIC_SOCKET_URL (e.g. https://luna-api.example.com) wins,
 * then NEXT_PUBLIC_API_URL, then the local dev default. Keep the URL public —
 * never put any shared secret in a NEXT_PUBLIC_ variable.
 *
 * Server rooms the client is automatically placed into:
 *   - `user:<id>`  — personal room for conversation messages / read receipts,
 *   - `feed`       — global room for news-feed post/broadcast events.
 */

import { io } from 'socket.io-client';
import { AUTH_EVENTS } from '@/lib/constants';
import { getAccessToken, refreshAccessToken, purgeSession } from '@/lib/session';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000';

/** @type {import('socket.io-client').Socket|null} */
let socket = null;
let pendingRefresh = false;

function canUse() {
  return typeof window !== 'undefined';
}

/**
 * Open the socket if a session is active. Idempotent: multiple mounts are safe
 * and will reuse the existing connection.
 * @param {string} [tokenOverride] - explicit token (used immediately after login)
 */
export function connectRealtime(tokenOverride) {
  if (!canUse() || socket?.connected) return;

  const token = tokenOverride || getAccessToken();
  if (!token) return;

  if (socket && !socket.connected) {
    socket.auth = { token };
    socket.connect();
    return;
  }

  socket = io(SOCKET_URL, { transports: ['websocket'], auth: { token } });

  socket.on('connect', () => {
    pendingRefresh = false;
  });

  // Before every reconnect attempt, refetch a fresh access token so a token
  // that expired while disconnected doesn't stall the retry loop.
  socket.on('reconnect_attempt', () => {
    socket.auth = { token: tokenOverride || getAccessToken() };
  });

  socket.on('connect_error', async (err) => {
    if (err?.message === 'unauthorized' && !pendingRefresh) {
      pendingRefresh = true;
      try {
        const result = await refreshAccessToken();
        if (result) {
          socket.auth = { token: getAccessToken() };
          socket.connect();
          return;
        }
      } catch {
        // fall through
      }
      purgeSession();
      if (canUse()) {
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.unauthorized));
      }
    }
  });
}

/** Tear down the connection entirely (logout / session invalid). */
export function disconnectRealtime() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    pendingRefresh = false;
  }
}

/** Raw socket access for emergency use only. @returns {import('socket.io-client').Socket|null} */
export function getSocket() {
  return socket;
}

/**
 * Subscribe to a server-pushed event. Automatically removes the listener on
 * disconnect so React components can clean up in an useEffect return.
 * @param {string} event
 * @param {(...args: any[]) => void} cb
 * @returns {() => void} unsubscribe
 */
export function on(event, cb) {
  if (!socket) return () => {};
  socket.on(event, cb);
  return () => socket?.off(event, cb);
}

/**
 * Remove a specific event listener.
 * @param {string} event
 * @param {(...args: any[]) => void} cb
 */
export function off(event, cb) {
  socket?.off(event, cb);
}

/**
 * Quick connectivity check (true only when the socket is authenticated).
 * @returns {boolean}
 */
export function isConnected() {
  return socket?.connected === true;
}