'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import BrandMark from '@/components/BrandMark';

const USERS_KEY = 'luna_users';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
};

function inputClass(hasError) {
  return [
    'w-full rounded-xl border bg-gray-800/70 py-2.5 pl-10 pr-10 text-sm text-gray-100 placeholder-gray-500 outline-none transition focus:ring-2',
    hasError
      ? 'border-[#EF4444]/70 focus:border-[#EF4444] focus:ring-[#EF4444]/30'
      : 'border-gray-700/80 focus:border-[#7C3AED] focus:ring-[#7C3AED]/40',
  ].join(' ');
}

/**
 * Password recovery page. Validates the email against localStorage
 * (`luna_users`) and, when a matching account exists, shows a simulated
 * "reset link sent" confirmation in the Luna design system.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [authError, setAuthError] = useState('');
  const [status, setStatus] = useState(STATUS.IDLE);

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldError('');
    setAuthError('');

    const value = email.trim();
    if (!value) {
      setFieldError('Email is required.');
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setFieldError('Please enter a valid email address.');
      return;
    }

    setStatus(STATUS.LOADING);

    try {
      await wait(900);

      const accountExists = readUsers().some(
        (u) => u.email.toLowerCase() === value.toLowerCase()
      );

      if (!accountExists) {
        setAuthError('No account found with that email. Please create an account first.');
        setStatus(STATUS.IDLE);
        return;
      }

      setStatus(STATUS.SUCCESS);
    } catch {
      setAuthError('Something went wrong. Please try again.');
      setStatus(STATUS.IDLE);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1F2937] px-4 py-12">
      {/* Ambient gradient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none"
      >
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#7C3AED]/25 blur-[110px]" />
        <div className="absolute -bottom-32 -right-28 h-96 w-96 rounded-full bg-[#F59E0B]/15 blur-[130px]" />
        <div className="absolute top-1/3 left-1/4 h-64 w-64 rounded-full bg-[#7C3AED]/10 blur-[100px]" />
      </div>

      <div className="relative flex w-full max-w-md flex-col items-center">
        <div className="mb-8">
          <BrandMark size="sm" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          {status === STATUS.SUCCESS ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-4 text-center"
            >
              <CheckCircle2
                className="h-14 w-14 text-[#10B981]"
                strokeWidth={1.5}
              />
              <h2 className="mt-4 text-2xl font-bold text-white">
                Check your inbox
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                We found the account for
                <span className="font-medium text-gray-200"> {email.trim()} </span>
                and sent a password reset link. It&apos;s only valid for the next
                30 minutes.
              </p>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setStatus(STATUS.IDLE)}
                className="mt-6 w-full rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9]"
              >
                Resend link
              </motion.button>
              <button
                type="button"
                onClick={() => router.push('/auth')}
                className="mt-4 flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-gray-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <header>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Forgot password?
                </h1>
                <p className="mt-1.5 text-sm text-gray-400">
                  No worries — enter the email linked to your account and we&apos;ll
                  send you a reset link.
                </p>
              </header>

              {authError && (
                <motion.p
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="rounded-lg bg-[#EF4444]/10 px-3 py-2 text-sm text-[#EF4444]"
                >
                  {authError}
                </motion.p>
              )}

              <div>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldError) setFieldError('');
                      if (authError) setAuthError('');
                    }}
                    className={inputClass(!!fieldError)}
                  />
                </div>
                {fieldError && (
                  <motion.p
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 pl-1 text-xs font-medium text-[#EF4444]"
                  >
                    {fieldError}
                  </motion.p>
                )}
              </div>

              <motion.button
                type="submit"
                disabled={status === STATUS.LOADING}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9] hover:shadow-xl hover:shadow-[#7C3AED]/50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === STATUS.LOADING ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending link…
                  </>
                ) : (
                  'Send reset link'
                )}
              </motion.button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => router.push('/auth')}
                  className="flex items-center gap-1.5 text-gray-400 transition hover:text-gray-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/auth?mode=create')}
                  className="text-[#A78BFA] transition hover:text-[#C4B5FD]"
                >
                  Create an account
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </main>
  );
}