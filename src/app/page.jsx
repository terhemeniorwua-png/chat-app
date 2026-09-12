'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import SplashScreen from '@/components/SplashScreen';
import AccountPickerScreen from '@/components/session/AccountPickerScreen';
import { useSession } from '@/hooks/useSession';
import { useDeviceProfiles } from '@/hooks/useDeviceProfiles';

const AuthContainer = dynamic(() => import('@/components/AuthContainer'), {
  ssr: false,
});

const STEP = {
  SPLASH: 'splash',
  PICKER: 'picker',
  AUTH: 'auth',
};

/**
 * Phase 1 : Splash loader          -> <SplashScreen />
 * Phase 2 : Session / router lock  -> decide where the user lands
 * Phase 3 : Account picker or auth ->
 *   - Saved local profiles exist   -> <AccountPickerScreen />
 *   - Else / re-auth fallback      -> <AuthContainer />
 *
 * A live session (fast-auth or the picker) pushes straight to /dashboard;
 * the picker routes fast-auth taps, and profiles without saved credentials
 * open the sign-in panel with their identity pre-filled.
 */
export default function Home() {
  const { session, fastAuth } = useSession();
  const { profiles, remove } = useDeviceProfiles();
  const [step, setStep] = useState(STEP.SPLASH);
  const [busyUserId, setBusyUserId] = useState(null);
  const [reauth, setReauth] = useState(null);
  const router = useRouter();

  const canFastAuth = (profile) =>
    profile.hasSavedCredentials && !profile.credentialsInvalid;

  async function handleSelect(profile) {
    if (!canFastAuth(profile)) {
      setReauth({ profile });
      setStep(STEP.AUTH);
      return;
    }
    setBusyUserId(profile.userId);
    try {
      await fastAuth(profile);
      router.replace('/dashboard');
    } catch {
      setBusyUserId(null);
      setReauth({ profile });
      setStep(STEP.AUTH);
    }
  }

  function handleSplashComplete() {
    if (session) {
      router.replace('/dashboard');
      return;
    }
    setStep(profiles.length > 0 ? STEP.PICKER : STEP.AUTH);
  }

  return (
    <AnimatePresence mode="wait">
      {step === STEP.SPLASH ? (
        <SplashScreen key="splash" onComplete={handleSplashComplete} />
      ) : step === STEP.PICKER ? (
        <AccountPickerScreen
          key="picker"
          profiles={profiles}
          busyUserId={busyUserId}
          onSelect={handleSelect}
          onAddNew={() => setStep(STEP.AUTH)}
          onRemove={(userId) => {
            remove(userId);
            setReauth(null);
          }}
        />
      ) : (
        <AuthContainer
          key="auth"
          initialIdentifier={reauth?.profile.username || ''}
          contextProfile={reauth?.profile || null}
        />
      )}
    </AnimatePresence>
  );
}