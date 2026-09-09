'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import BrandMark from '@/components/BrandMark';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const CODE_LENGTH = 5;
const RESET_TOKEN_KEY = 'luna_reset_token';

function codeInputClass(hasError, filled) {
  return [
    'h-14 w-12 rounded-xl border bg-gray-800/70 text-center text-xl font-bold text-white outline-none transition focus:ring-2 sm:w-14',
    filled && !hasError ? 'border-gray-500/70' : '',
    hasError
      ? 'border-[#EF4444]/70 focus:border-[#EF4444] focus:ring-[#EF4444]/30'
      : 'border-gray-700/80 focus:border-[#7C3AED] focus:ring-[#7C3AED]/40',
  ].join(' ');
}

/**
 * Step 2 of the password-recovery flow. Collects the emailed 5-digit code in
 * five single-digit boxes (auto-advance, backspace, arrow keys and paste all
 * work), verifies it via POST /api/auth/verify-code, then stashes the returned
 * reset token in sessionStorage and forwards to /forgot-password/reset.
 */
function VerifyCodeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(''));
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  const code = digits.join('');
  const complete = code.length === CODE_LENGTH;

  function setDigitAt(index, digit) {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
  }

  function handleChange(index, raw) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setDigitAt(index, digit);
    if (authError) setAuthError('');
    if (digit && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(index, e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!text) return;

    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < text.length; i += 1) {
      next[i] = text[i];
    }
    setDigits(next);
    if (authError) setAuthError('');
    const target = Math.min(index + text.length, CODE_LENGTH - 1);
    inputs.current[target]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!complete) {
      setAuthError('Please enter all 5 digits.');
      return;
    }

    setAuthError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAuthError(data.message || 'Verification failed. Please try again.');
        setLoading(false);
        return;
      }

      sessionStorage.setItem(RESET_TOKEN_KEY, data.resetToken);
      router.push(`/forgot-password/reset?email=${encodeURIComponent(email)}`);
    } catch {
      setAuthError('Could not reach the Luna server. Please make sure it is running.');
      setLoading(false);
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
          {!email ? (
            <div className="flex flex-col items-center py-6 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Missing email
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Something went wrong. Please restart the password recovery flow.
              </p>
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to recovery
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <header className="text-center">
                <KeyRound
                  aria-hidden="true"
                  className="mx-auto h-10 w-10 text-[#7C3AED]"
                />
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
                  Check your inbox
                </h2>
                <p className="mt-1.5 text-sm text-gray-400">
                  We sent a 5-digit code to
                  <span className="font-medium text-gray-200"> {email} </span>
                  . It expires in 10 minutes.
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

              <fieldset disabled={loading}>
                <legend className="sr-only">5-digit verification code</legend>
                <div className="flex justify-center gap-2 sm:gap-3">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      disabled={loading}
                      aria-label={`Digit ${index + 1}`}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={(e) => handlePaste(index, e)}
                      className={codeInputClass(false, !!digit)}
                    />
                  ))}
                </div>
              </fieldset>

              <motion.button
                type="submit"
                disabled={loading || !complete}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9] hover:shadow-xl hover:shadow-[#7C3AED]/50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  'Verify code'
                )}
              </motion.button>

              <p className="text-center text-sm text-gray-400">
                Didn&apos;t get the code?{' '}
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/forgot-password?email=${encodeURIComponent(email)}`)
                  }
                  className="text-[#A78BFA] transition hover:text-[#C4B5FD]"
                >
                  Resend it
                </button>
              </p>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => router.push('/auth')}
                  className="flex items-center gap-1.5 text-gray-400 transition hover:text-gray-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </main>
  );
}

export default function VerifyCodePage() {
  return (
    <Suspense fallback={null}>
      <VerifyCodeContent />
    </Suspense>
  );
}