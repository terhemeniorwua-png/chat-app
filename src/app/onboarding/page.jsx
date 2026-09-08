'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * Guideline / App Tour entry point for brand-new Luna users.
 * Reads the simulated `isNewUser` flag produced by the auth gateway.
 */
function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewUser = searchParams.get('isNewUser') === 'true';

  const steps = [
    {
      title: 'Start a conversation',
      body: 'Open any chat in your friend list and say hello — Luna keeps every light conversation flowing in real time.',
    },
    {
      title: 'Grow your circles',
      body: 'Create groups, start voice calls, and pin the people who matter most. Everything syncs instantly.',
    },
    {
      title: 'Stay in the light',
      body: 'Manage notifications, appearance, and privacy from a single Settings panel designed for focus.',
    },
  ];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1F2937] px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none"
      >
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[#7C3AED]/25 blur-[110px]" />
        <div className="absolute bottom-0 -left-28 h-96 w-96 rounded-full bg-[#F59E0B]/15 blur-[130px]" />
      </div>

      <div className="relative w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#7C3AED]/20 px-3 py-1 text-xs font-semibold tracking-wide text-[#C4B5FD]">
              <Sparkles className="h-3.5 w-3.5" />
              {isNewUser ? 'Welcome to Luna' : 'Your dashboard'}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">
            {isNewUser
              ? 'Let’s get you settled.'
              : 'Welcome back to Luna.'}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {isNewUser
              ? 'A quick tour of how your light conversation works.'
              : 'Your chats are right where you left them.'}
          </p>

          {isNewUser && (
            <ol className="mt-7 space-y-4">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/5 bg-gray-800/50 p-4"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#7C3AED] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{step.title}</p>
                    <p className="mt-0.5 text-sm text-gray-400">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/dashboard')}
            className="group mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9]"
          >
            Continue to dashboard
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </motion.button>
        </motion.div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}