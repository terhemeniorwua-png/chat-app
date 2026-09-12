'use client';

import { useCallback, useEffect, useState } from 'react';
import { DeviceProfileManager } from '@/lib/deviceProfileStorageManager';

/** Notifies every mount site when the profiles blob changes. */
function notifyProfilesChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('luna:profiles-changed'));
  }
}

/**
 * Reactive view over DeviceProfileManager. All mutations go through this hook
 * so local state and the persisted blob never drift apart.
 * @typedef {import('@/lib/constants').StoredProfile} StoredProfile
 */
export function useDeviceProfiles() {
  const [profiles, setProfiles] = useState(() => DeviceProfileManager.listProfiles());

  const refresh = useCallback(() => {
    setProfiles(DeviceProfileManager.listProfiles());
  }, []);

  useEffect(() => {
    window.addEventListener('luna:profiles-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('luna:profiles-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const upsert = useCallback((profile) => {
    DeviceProfileManager.upsertProfile(profile);
    notifyProfilesChanged();
  }, []);

  const remove = useCallback((userId) => {
    DeviceProfileManager.removeProfile(userId);
    notifyProfilesChanged();
  }, []);

  const clearAll = useCallback(() => {
    DeviceProfileManager.clearAllProfiles();
    notifyProfilesChanged();
  }, []);

  return { profiles, getProfile: DeviceProfileManager.getProfile, upsert, remove, clearAll, refresh };
}

/** @typedef {ReturnType<typeof useDeviceProfiles>} DeviceProfilesHook */