'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Loader2,
  User,
} from 'lucide-react';
import BrandMark from '@/components/BrandMark';

const TABS = {
  SIGN_IN: 'sign-in',
  CREATE_ACCOUNT: 'create-account',
};

const USERS_KEY = 'luna_users';
const SESSION_KEY = 'luna_current_user';

const NAME_RE = /^[a-zA-Z\s-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&-_])[A-Za-z\d@$!%*?&-_]{5,}$/;

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

function FieldError({ message }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1.5 pl-1 text-xs font-medium text-[#EF4444]"
    >
      {message}
    </motion.p>
  );
}

function inputClass(hasError) {
  return [
    'w-full rounded-xl border bg-gray-800/70 py-2.5 pl-10 pr-10 text-sm text-gray-100 placeholder-gray-500 outline-none transition focus:ring-2 sm:pr-10',
    hasError
      ? 'border-[#EF4444]/70 focus:border-[#EF4444] focus:ring-[#EF4444]/30'
      : 'border-gray-700/80 focus:border-[#7C3AED] focus:ring-[#7C3AED]/40',
  ].join(' ');
}

/**
 * Full panel for /auth: brand lockup, Sign In / Create Account switcher, and
 * localStorage-backed auth. New accounts are stored under `luna_users`, the
 * active session under `luna_current_user`:
 *   - Sign In  -> /dashboard (returning users)
 *   - Signup   -> /onboarding (new users)
 *
 * @param {object} props
 * @param {boolean} [props.initialCreate=false] - start with the Create Account tab.
 */
export default function AuthGateway({ initialCreate = false }) {
  const [tab, setTab] = useState(initialCreate ? TABS.CREATE_ACCOUNT : TABS.SIGN_IN);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

    if (!email) {
      errors.email = 'Email is required.';
    } else if (!EMAIL_RE.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!values.password) {
      errors.password = 'Password is required.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setLoading(false);
      return;
    }

    try {
      await wait(800);

      const user = readUsers().find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );

      if (!user || user.password !== values.password) {
        setAuthError(
          'Account does not exist or credentials are incorrect. Please create an account first.'
        );
        setLoading(false);
        return;
      }

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ id: user.id, name: user.name, email: user.email })
      );
      router.push('/dashboard');
    } catch {
      setAuthError('Something went wrong. Please try again.');
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

    if (!name) {
      errors.fullName = 'Full name is required.';
    } else if (!NAME_RE.test(name)) {
      errors.fullName = 'Name can only contain letters, spaces, and hyphens.';
    }

    if (!email) {
      errors.email = 'Email is required.';
    } else if (!EMAIL_RE.test(email)) {
      errors.email = 'Please enter a valid email address.';
    } else if (
      readUsers().some((u) => u.email.toLowerCase() === email.toLowerCase())
    ) {
      errors.email = 'An account with this email already exists. Please sign in instead.';
    }

    if (!values.password) {
      errors.password = 'Password is required.';
    } else if (values.password.length < 5) {
      errors.password = 'Password must be at least 5 characters long.';
    } else if (!PASSWORD_RE.test(values.password)) {
      errors.password =
        'Password must include an uppercase letter, a lowercase letter, a number, and a special character.';
    }

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
      await wait(800);

      const newUser = {
        id: Date.now(),
        name,
        email,
        password: values.password,
      };

      const users = readUsers();
      users.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ id: newUser.id, name: newUser.name, email: newUser.email })
      );

      router.push('/onboarding?isNewUser=true');
    } catch {
      setAuthError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    if (isSignIn) {
      return handleSignIn(e);
    }
    return handleSignup(e);
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

              <div>
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Password"
                    autoComplete={isSignIn ? 'current-password' : 'new-password'}
                    minLength={5}
                    value={values.password}
                    onChange={(e) => setValue('password', e.target.value)}
                    className={inputClass(!!fieldErrors.password)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-200"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <FieldError message={fieldErrors.password} />
              </div>

              {!isSignIn && (
                <div>
                  <div className="relative">
                    <Lock
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      minLength={5}
                      value={values.confirmPassword}
                      onChange={(e) => setValue('confirmPassword', e.target.value)}
                      className={inputClass(!!fieldErrors.confirmPassword)}
                    />
                  </div>
                  <FieldError message={fieldErrors.confirmPassword} />
                </div>
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

            {/* Social login */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:bg-gray-700/60"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </motion.button>
          </motion.div>

          <p className="mt-6 text-center text-xs text-gray-500">
            By continuing you agree to Luna&apos;s terms & privacy policy.
          </p>
        </motion.div>
      </div>
    </main>
  );
}