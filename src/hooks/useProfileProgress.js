'use client';

import { useMemo } from 'react';
import { computeProfileProgress } from '@/lib/profileProgress';

/** Reactive profile-completion tracker fed by the current AuthUser profile. */
export function useProfileProgress(profile) {
  const progress = useMemo(() => computeProfileProgress(profile ?? {}), [profile]);
  return progress;
}

/** @typedef {ReturnType<typeof useProfileProgress>} ProfileProgressHook */