'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Phone } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import { FieldError, inputClass } from '@/components/fields';
import { validatePhoneNumber } from '@/lib/validation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Step 1 of the SMS password-recovery flow. Requests a 6-digit OTP for the
 * registered phone number (mocked SMS is logged server-side) and forwards to
 * /forgot-password/verify?phone=... on success.
 */
function ForgotPasswordRequest() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldError('');
    setAuthError('');

    const value = phoneNumber.trim();
    const phoneError = validatePhoneNumber(value);
    if (phoneError) {
      setFieldError(phoneError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: value }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFieldError(data.fieldErrors?.phoneNumber || '');
        setAuthError(data.message || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      router.push(`/forgot-password/verify?phone=${encodeURIComponent(value)}`);
    } catch {
      setAuthError('Could not reach the Luna server. Please make sure it is running.');
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--luna-bg)] px-4 py-12">
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
          className="w-full rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-white/5 sm:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <header>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Forgot password?
              </h1>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                No worries — enter the phone number linked to your account and
                we&apos;ll text you a 6-digit code to reset it.
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
                <Phone
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="tel"
                  name="phoneNumber"
                  placeholder="Phone number"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (fieldError) setFieldError('');
                    if (authError) setAuthError('');
                  }}
                  className={inputClass(!!fieldError)}
                />
              </div>
              <FieldError message={fieldError} />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9] hover:shadow-xl hover:shadow-[#7C3AED]/50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending code…
                </>
              ) : (
                'Send OTP'
              )}
            </motion.button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => router.push('/auth')}
                className="flex items-center gap-1.5 text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
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
        </motion.div>
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordRequest />
    </Suspense>
  );
}