'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useSession } from '@/hooks/useSession';

const ChatHub = dynamic(() => import('@/components/chat/ChatHub'), {
  ssr: false,
});

function DashboardGate() {
  const { session, loading } = useSession(); // Include loading if available from your hook
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  // Guarantee hydration matches SSR output before switching UI
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !session && !loading) {
      router.replace('/');
    }
  }, [isMounted, session, loading, router]);

  // Render spinner during SSR and initial client hydration turn
  if (!isMounted || !session) {
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