'use client';

import { useCallback } from 'react';
import {
  gatedAction,
  getPermissionState,
  hasPermission,
  isPermissionSupported,
  requestPermission,
} from '@/lib/permissions';

/**
 * useContextualPermissions — the "defer until used" permission policy.
 *   supported(kind) — is this permission even available on this device?
 *   state(kind)     — granted / denied / unavailable / idle
 *   has(kind)       — can I use the feature right now without prompting?
 *   request(kind)   — prompt now (called from the exact action that needs it)
 *   gateFor(kind, fn) — wrap an action so it gates on the permission first
 */
export function useContextualPermissions() {
  const supported = useCallback((kind) => isPermissionSupported(kind), []);
  const state = useCallback((kind) => getPermissionState(kind), []);
  const has = useCallback((kind) => hasPermission(kind), []);
  const request = useCallback((kind) => requestPermission(kind), []);
  const gateFor = useCallback((kind, fn) => gatedAction(kind, fn), []);

  return { supported, state, has, request, gateFor };
}

/** @typedef {ReturnType<typeof useContextualPermissions>} ContextualPermissions */