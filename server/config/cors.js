/**
 * Shared CORS allowlist for both the REST API and the Socket.IO handshake.
 *
 * `CLIENT_URL` configures the production frontend origin(s) — comma-separated
 * when the Vercel project spans a *.vercel.app hostname plus a custom domain.
 * The local dev frontend is always allowed so the same backend serves both
 * `localhost` development and the deployed Vercel app without credentialless
 * `origin: '*'` (which is invalid when `credentials: true` is enabled).
 *
 * Usage:
 *   import { allowedOrigins } from './cors.js';
 *   app.use(cors({ origin: allowedOrigins(), credentials: true }));
 */

const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/**
 * The complete, explicit list of allowed browser origins.
 * @returns {string[]}
 */
export function allowedOrigins() {
  const configured = (process.env.CLIENT_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set([...DEV_ORIGINS, ...configured])];
}

/**
 * True when the request origin is on the allowlist. Used to give Socket.IO and
 * REST a single source of truth for what the browser is allowed to call.
 * @param {string|undefined} origin - the request's Origin header.
 * @returns {boolean}
 */
export function originIsAllowed(origin) {
  if (!origin) return false;
  return allowedOrigins().includes(origin);
}