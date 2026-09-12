'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, Loader2, User } from 'lucide-react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import BrandMark from '@/components/BrandMark';
import { FieldError, inputClass, PasswordInput } from '@/components/fields';
import {
  validateEmail,
  validateFullName,
  validatePassword,
} from '@/lib/validation';

const TABS = {
  SIGN_IN: 'sign-in',
  CREATE_ACCOUNT: 'create-account',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

// Session keys persisted on the client once authentication succeeds.
const TOKEN_KEY = 'luna_token';
const USER_KEY = 'luna_user';

const tabVariants = {
  hidden: (tab) => ({
    x: tab === TABS.SIGN_IN ? -28 : 28,
    opacity: 0,
    transition: { duration: 0 },
  }),
  visible: {
    x: 0,
    opacity: 1,
    transition: { delay: 0.08, duration: 0.35, ease: 'easeOut' },
  },
};

async function apiPost(path, payload) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Could not reach the Luna server. Please make sure it is running.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || 'Something went wrong. Please try again.');
    error.fieldErrors = data.fieldErrors || {};
    throw error;
  }

  return data;
}

function persistSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function GoogleIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5.04c1.6 0 3.03.55 4.16 1.63l3.1-3.1C17.44 1.68 14.96.6 12 .6 7.45.6 3.54 3.22 1.8 7.01l3.62 2.8A7.1 7.1 0 0 1 12 5.04Z"
      />
      <path
        fill="#4285F4"
        d="M23.4 12.27c0-.86-.08-1.7-.23-2.5H12v4.73h6.42a5.4 5.4 0 0 1-2.34 3.55l3.54 2.74c2.09-1.93 3.78-4.77 3.78-8.52Z"
      />
      <path
        fill="#FBBC05"
        d="M5.43 14.2a7.4 7.4 0 0 1 0-4.4L1.8 6.98a12.04 12.04 0 0 0 0 10.04l3.63-2.82Z"
      />
      <path
        fill="#34A853"
        d="M12 23.4c3.24 0 5.96-1.08 7.95-2.92l-3.54-2.74c-1 .67-2.29 1.07-4.41 1.07a7.1 7.1 0 0 1-6.57-4.4L1.8 17c1.74 3.78 5.65 6.4 10.2 6.4Z"
      />
    </svg>
  );
}

/**
 * Full panel for /auth and the post-splash screen. Sends credentials to the
 * Luna API (Express + MongoDB):
 *   - POST /api/auth/signup           -> new users, route to /onboarding
 *   - POST /api/auth/login            -> returning users, route to /dashboard
 *   - POST /api/auth/google           -> Google OAuth (verified credential)
 *
 * On success the returned JWT + user object are persisted in
 * `luna_token` / `luna_user`. Backend field errors render under the inputs.
 *
 * @param {object} props
 * @param {boolean} [props.initialCreate=false] - start with the Create Account tab.
 * @param {string} [props.initialNotice=''] - optional success banner (e.g. after a password reset).
 */
export default function AuthGateway({ initialCreate = false, initialNotice = '' }) {
  const [tab, setTab] = useState(initialCreate ? TABS.CREATE_ACCOUNT : TABS.SIGN_IN);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState(initialNotice || '');
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const router = useRouter();

  const isSignIn = tab === TABS.SIGN_IN;

  function setValue(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
  }

  function switchTab(value) {
    setTab(value);
    setFieldErrors({});
    setAuthError('');
    setLoading(false);
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    const email = values.email.trim();
    const errors = {};

    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    const passwordError = validatePassword(values.password);
    if (passwordError) errors.password = passwordError;

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiPost('/api/auth/login', { email, password: values.password });
      persistSession(data.token, data.user);
      router.push('/dashboard');
    } catch (err) {
      setFieldErrors(err.fieldErrors || {});
      setAuthError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    const name = values.fullName.trim().replace(/\s+/g, ' ');
    const email = values.email.trim();
    const errors = {};

    const nameError = validateFullName(name);
    if (nameError) errors.fullName = nameError;

    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;

    const passwordError = validatePassword(values.password);
    if (passwordError) errors.password = passwordError;

    if (!values.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (values.confirmPassword !== values.password) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiPost('/api/auth/signup', {
        name,
        email,
        password: values.password,
      });
      persistSession(data.token, data.user);
      router.push('/onboarding?isNewUser=true');
    } catch (err) {
      setFieldErrors(err.fieldErrors || {});
      setAuthError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleGoogleCredential(credential) {
    setAuthError('');
    setLoading(true);

    try {
      const data = await apiPost('/api/auth/google', { credential });
      persistSession(data.token, data.user);
      router.push('/dashboard');
    } catch (err) {
      setFieldErrors(err.fieldErrors || {});
      setAuthError(err.message || 'Google sign-in failed.');
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    if (isSignIn) {
      return handleSignIn(e);
    }
    return handleSignup(e);
  }

  const content = (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1F2937] px-4 py-12">
      {/* Ambient gradient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none"
      >
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#7C3AED]/25 blur-[110px]" />
        <div className="absolute -bottom-32 -right-28 h-96 w-96 rounded-full bg-[#F59E0B]/15 blur-[130px]" />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-[#7C3AED]/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-5xl grid-cols-1 gap-10 lg:grid lg:grid-cols-2 lg:items-center">
        {/* Left: larger brand lockup (desktop only) */}
        <div className="hidden lg:flex lg:justify-center lg:px-4">
          <BrandMark scoped size="lg" />
        </div>

        {/* Right: Auth card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          {/* Mobile brand header */}
          <div className="mb-8 lg:hidden">
            <h1 className="text-center text-3xl font-bold lowercase tracking-tight text-white">
              luna
            </h1>
            <p className="mt-1 text-center text-sm font-light tracking-wide text-gray-400">
              a new light on conversation
            </p>
          </div>

          {/* Tab switcher */}
          <div className="relative mb-6 grid grid-cols-2 rounded-xl bg-gray-800/80 p-1">
            <motion.span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 rounded-lg bg-[#7C3AED] shadow-lg shadow-[#7C3AED]/40"
              animate={{
                x: tab === TABS.SIGN_IN ? '0%' : '100%',
                width: 'calc(50% - 4px)',
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            />
            {[TABS.SIGN_IN, TABS.CREATE_ACCOUNT].map((value) => {
              const label = value === TABS.SIGN_IN ? 'Sign In' : 'Create Account';
              const active = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchTab(value)}
                  className={`relative z-10 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <motion.div
            role="tabpanel"
            key={tab}
            custom={tab}
            variants={tabVariants}
            initial="hidden"
            animate="visible"
          >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {notice && (
                <motion.p
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  className="rounded-lg bg-[#10B981]/10 px-3 py-2 text-sm text-[#10B981]"
                >
                  {notice}
                </motion.p>
              )}

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

              {!isSignIn && (
                <div>
                  <div className="relative">
                    <User
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type="text"
                      name="fullName"
                      placeholder="Full name"
                      autoComplete="name"
                      value={values.fullName}
                      onChange={(e) => setValue('fullName', e.target.value)}
                      className={inputClass(!!fieldErrors.fullName)}
                    />
                  </div>
                  <FieldError message={fieldErrors.fullName} />
                </div>
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
                    value={values.email}
                    onChange={(e) => setValue('email', e.target.value)}
                    className={inputClass(!!fieldErrors.email)}
                  />
                </div>
                <FieldError message={fieldErrors.email} />
              </div>

              <PasswordInput
                name="password"
                placeholder="Password"
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                value={values.password}
                onChange={(v) => setValue('password', v)}
                error={fieldErrors.password}
              />

              {!isSignIn && (
                <PasswordInput
                  name="confirmPassword"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  value={values.confirmPassword}
                  onChange={(v) => setValue('confirmPassword', v)}
                  error={fieldErrors.confirmPassword}
                />
              )}

              {isSignIn && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-gray-300">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      className="h-4 w-4 cursor-pointer accent-[#7C3AED]"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className="text-[#A78BFA] transition hover:text-[#C4B5FD]"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Primary CTA */}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9] hover:shadow-xl hover:shadow-[#7C3AED]/50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isSignIn ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : (
                  <>
                    {isSignIn ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-700" />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                or continue with
              </span>
              <span className="h-px flex-1 bg-gray-700" />
            </div>

            {/* Google OAuth */}
            {GOOGLE_CLIENT_ID ? (
              <GoogleLogin
                onSuccess={({ credential }) => {
                  if (credential) handleGoogleCredential(credential);
                }}
                onError={() => {
                  setLoading(false);
                  setAuthError('Google sign-in failed. Please try again.');
                }}
                shape="pill"
                theme="filled_black"
                text="continue_with"
                size="large"
                render={({ onClick }) => (
                  <motion.button
                    type="button"
                    onClick={onClick}
                    disabled={loading}
                    whileTap={{ scale: 0.98 }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:bg-gray-700/60 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <GoogleIcon className="h-4 w-4" />
                    Continue with Google
                  </motion.button>
                )}
              />
            ) : (
              <button
                type="button"
                onClick={() =>
                  setAuthError(
                    'Google sign-in is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env.local.'
                  )
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:bg-gray-700/60"
              >
                <GoogleIcon className="h-4 w-4" />
                Continue with Google
              </button>
            )}
          </motion.div>

          <p className="mt-6 text-center text-xs text-gray-500">
            By continuing you agree to Luna&apos;s terms & privacy policy.
          </p>
        </motion.div>
      </div>
    </main>
  );

  if (!GOOGLE_CLIENT_ID) {
    return content;
  }

  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{content}</GoogleOAuthProvider>;
}