'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import SplashScreen from '@/components/SplashScreen';

const AuthGateway = dynamic(() => import('@/components/AuthGateway'), {
  ssr: false,
});

/**
 * Phase 1 : Splash loader     -> <SplashScreen />
 * Phase 2 : Auth gateway      -> <AuthGateway />
 *
 * <AnimatePresence mode="wait"> waits for the splash's exit transition to
 * finish before mounting the auth view, giving one smooth cross-fade.
 */
export default function Home() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <AnimatePresence mode="wait">
      {showSplash ? (
        <SplashScreen
          key="splash"
          onComplete={() => setShowSplash(false)}
        />
      ) : (
        <AuthGateway key="auth" />
      )}
    </AnimatePresence>
  );
}