'use client';

import { Suspense, useSyncExternalStore, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import { PasswordInput } from '@/components/fields';
import { validatePassword } from '@/lib/validation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const RESET_TOKEN_KEY = 'luna_reset_token';

const subscribeToResetToken = () => () => {};

const resetTokenSnapshot = () =>
  typeof window === 'undefined'
    ? ''
    : sessionStorage.getItem(RESET_TOKEN_KEY) || '';

/**
 * Step 3 of the password-recovery flow. The user was routed here after
 * verifying their code; the verification JWT lives in sessionStorage and the
 * new password is sent with it to POST /api/auth/reset-password. On success a
 * confirmation is shown and the user is sent back to /auth to sign in.
 */
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetToken = useSyncExternalStore(
    subscribeToResetToken,
    resetTokenSnapshot,
    resetTokenSnapshot
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setAuthError('');
    setFieldErrors({});

    const errors = {};
    const passwordError = validatePassword(password);
    if (passwordError) errors.password = passwordError;
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFieldErrors((prev) => ({
          ...prev,
          password: data.fieldErrors?.password || '',
        }));
        setAuthError(data.message || 'Password reset failed. Please try again.');
        // Token is consumed/voided on any failure too — require a fresh code.
        sessionStorage.removeItem(RESET_TOKEN_KEY);
        setLoading(false);
        return;
      }

      sessionStorage.removeItem(RESET_TOKEN_KEY);
      setSuccess(true);
      setTimeout(() => router.push('/auth?reset=success'), 2000);
    } catch {
      setAuthError('Could not reach the Luna server. Please make sure it is running.');
      setLoading(false);
    }
  }

  function restart() {
    sessionStorage.removeItem(RESET_TOKEN_KEY);
    router.push('/forgot-password');
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
          {success ? (
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
                Password updated
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Your password has been reset. Taking you back to sign in…
              </p>
              <button
                type="button"
                onClick={() => router.push('/auth')}
                className="mt-6 w-full rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9]"
              >
                Go to sign in
              </button>
            </motion.div>
          ) : !resetToken ? (
            <div className="flex flex-col items-center py-6 text-center">
              <RotateCcw
                aria-hidden="true"
                className="h-10 w-10 text-[#F59E0B]"
              />
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
                Reset link expired
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                This password reset session is invalid or has expired. Request a
                new code to continue.
              </p>
              <button
                type="button"
                onClick={restart}
                className="mt-6 w-full rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9]"
              >
                Start over
              </button>
              <button
                type="button"
                onClick={() => router.push('/auth')}
                className="mt-4 flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-gray-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <header>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Set a new password
                </h1>
                <p className="mt-1.5 text-sm text-gray-400">
                  {email
                    ? `Choose a new password for ${email}.`
                    : 'Choose a new password for your account.'}
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

              <PasswordInput
                name="password"
                placeholder="New password"
                autoComplete="new-password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: '' }));
                  }
                }}
                error={fieldErrors.password}
              />

              <PasswordInput
                name="confirmPassword"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(v) => {
                  setConfirmPassword(v);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }
                }}
                error={fieldErrors.confirmPassword}
              />

              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9] hover:shadow-xl hover:shadow-[#7C3AED]/50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resetting…
                  </>
                ) : (
                  'Reset password'
                )}
              </motion.button>

              <button
                type="button"
                onClick={() => router.push('/auth')}
                className="flex w-full items-center justify-center gap-1.5 text-sm text-gray-400 transition hover:text-gray-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}