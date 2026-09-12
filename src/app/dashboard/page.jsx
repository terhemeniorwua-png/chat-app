'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserPlus, UserCheck } from 'lucide-react';
import Link from 'next/link';

/**
 * Landing stub for returning users (isNewUser=false). Walls off the old
 * mock chat UI until the real dashboard lists are wired to the auth flow.
 */
function DashboardStub() {
  const searchParams = useSearchParams();
  const isNewUser = searchParams.get('isNewUser') === 'true';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#1F2937] px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md"
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#F59E0B] to-[#FBBF24]">
          <span className="h-8 w-8 rounded-full bg-[#7C3AED]" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          {isNewUser ? 'Dashboard coming right up' : 'Welcome back to Luna'}
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          This is the landing stub for returning users. A full chat hub lives
          here once the friend list & messaging is wired up.
        </p>
      </motion.div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/friends/suggestions"
          className="flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6D28D9]"
        >
          <UserPlus className="h-4 w-4" />
          Friend suggestions
        </Link>
        <Link
          href="/friends/requests"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
        >
          <UserCheck className="h-4 w-4" />
          Friend requests
        </Link>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardStub />
    </Suspense>
  );
}