'use client';

import { useCallback, useState } from 'react';
import {
  createInitialSyncState,
  getPersistedSyncStatus,
  persistSyncStatus,
  reduceSyncState,
} from '@/lib/reengagement';

/**
 * useSyncState — drives the "Syncing messages…" header indicator during the
 * background catch-up that follows a returning user's first reconnect. Status
 * survives a reload so the pill isn't lost mid-catch-up.
 */
export function useSyncState() {
  const [sync, setSync] = useState(() => ({
    ...createInitialSyncState(),
    status: getPersistedSyncStatus(),
  }));

  const beginSync = useCallback(() => {
    setSync((prev) => reduceSyncState(prev, { to: 'syncing' }));
    persistSyncStatus('syncing');
  }, []);

  const complete = useCallback((failed = false) => {
    const next = failed ? 'offline' : 'synced';
    setSync((prev) => reduceSyncState(prev, { to: next }));
    persistSyncStatus(next);
  }, []);

  const reset = useCallback(() => {
    setSync(createInitialSyncState());
    persistSyncStatus('idle');
  }, []);

  return { sync, beginSync, complete, reset };
}

/** @typedef {ReturnType<typeof useSyncState>} SyncStateHook */