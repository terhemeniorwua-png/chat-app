'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useSession } from '@/hooks/useSession';

/**
 * Landing for the signed-in user. Sessions come from `@/hooks/useSession`
 * (fast-auth restore / event-driven), so a hard refresh here re-attaches the
 * active account instead of bouncing through the auth screen.
 */
const ChatHub = dynamic(() => import('@/components/chat/ChatHub'), {
  ssr: false,
});

function DashboardGate() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      router.replace('/');
    }
  }, [session, router]);

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1F2937]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="h-10 w-10 rounded-full border-4 border-[#7C3AED] border-t-transparent"
        />
      </main>
    );
  }

  return <ChatHub />;
}

export default function DashboardPage() {
  return <DashboardGate />;
}