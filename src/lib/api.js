/**
 * Thin fetch wrapper for the Luna API. Token lifecycle now lives in
 * `@/lib/session` (access token + refresh rotation); this module only wires a
 * 401 → refresh → retry loop on top of it.
 */

import {
  getAccessToken,
  getCurrentUser as getActiveUser,
  purgeSession,
  refreshAccessToken,
} from '@/lib/session';
import { AUTH_EVENTS } from '@/lib/constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function getToken() {
  return getAccessToken();
}

export function getCurrentUser() {
  return getActiveUser();
}

export function clearSession() {
  purgeSession();
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

async function perform(method, path, body, token) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      'Could not reach the Luna server. Please make sure it is running.'
    );
  }

  if (res.status === 401 && token) {
    throw new UnauthorizedError('Session expired. Please sign in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || 'Something went wrong. Please try again.');
    error.fieldErrors = data.fieldErrors || {};
    throw error;
  }
  return data;
}

async function request(method, path, body) {
  let token = getToken();

  try {
    return await perform(method, path, body, token);
  } catch (err) {
    // One honest attempt at rotating the access token, then retry the call.
    if (err instanceof UnauthorizedError && token) {
      try {
        await refreshAccessToken();
      } catch {
        purgeSession();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(AUTH_EVENTS.unauthorized));
        }
        throw new Error('Session expired. Please sign in again.');
      }
      token = getToken();
      return perform(method, path, body, token);
    }
    throw err;
  }
}

export const apiGet = (path) => request('GET', path);
export const apiPost = (path, body) => request('POST', path, body);
export const apiPut = (path, body) => request('PUT', path, body);
export const apiPatch = (path, body) => request('PATCH', path, body);
export const apiDelete = (path) => request('DELETE', path);