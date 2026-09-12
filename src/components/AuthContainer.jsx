'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, Loader2, User, X, Zap } from 'lucide-react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import BrandMark from '@/components/BrandMark';
import ThemeToggle from '@/components/ThemeToggle';
import { FieldError, inputClass, PasswordInput } from '@/components/fields';
import {
  validateEmail,
  validateFullName,
  validatePassword,
} from '@/lib/validation';
import {
  persistAuthSession,
  clearRememberedPassword,
  rememberPassword,
} from '@/lib/session';
import { useSession } from '@/hooks/useSession';
import { useDeviceProfiles } from '@/hooks/useDeviceProfiles';

const TABS = {
  SIGN_IN: 'sign-in',
  CREATE_ACCOUNT: 'create-account',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

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

function AppleIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.24 3.03-.92.92-2.09 1.45-3.08 1.36-.06-.99.38-2.08 1.19-2.9.77-.83 2.02-1.45 3.13-1.49Zm3.72 14.12c.3.75.5 1.46.72 2.23.31.95.5 1.87.51 2.03 0 .06-.06.1-.16.07a7.6 7.6 0 0 1-2.92-1.9c-.63-.72-1.16-1.4-1.6-1.9-.76.8-1.55 1.2-2.62 1.26-.94.06-1.96-.24-2.9-.83-1.6-.99-2.88-2.6-3.73-4.63-.87-2.1-1.2-4.14-.92-6.06.28-1.93 1.19-3.52 2.75-4.63.98-.71 2.06-1.06 3.26-1.02 1.11.04 2.1.32 2.96.93.42-.18.86-.4 1.31-.52.5-.13 1.05-.18 1.63-.13.48.04.9.13 1.28.27-.2.47-.4.89-.62 1.28-.38.66-.9 1.27-1.57 1.76-1.2.87-1.8 1.96-1.84 3.32-.05 1.9 1.18 3.4 3.1 4.14.44.18.9.3 1.27.37.22.04.42.06.64.04Z" />
    </svg>
  );
}

/**
 * AuthContainer — the primary authentication surface. Strictly two tabs:
 * "Sign In" and "Create Account" (no OTP). Alongside the form it renders the
 * Saved Profiles list so a saved account can tap-to-login — or, when only
 * metadata was kept ("Logout Only"), route to a password re-auth prompt.
 *
 *   - POST /api/auth/signup        -> new users, route to /onboarding
 *   - POST /api/auth/login         -> returning users (email OR username)
 *   - POST /api/auth/google        -> Google OAuth (verified credential)
 *
 * @param {object} props
 * @param {boolean} [props.initialCreate=false]
 * @param {string} [props.initialNotice='']
 * @param {string} [props.initialIdentifier='']
 * @param {import('@/lib/constants').StoredProfile|null} [props.contextProfile=null]
 */
export default function AuthContainer({
  initialCreate = false,
  initialNotice = '',
  initialIdentifier = '',
  contextProfile = null,
}) {
  const [tab, setTab] = useState(
    initialCreate ? TABS.CREATE_ACCOUNT : TABS.SIGN_IN
  );
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState(initialNotice || '');
  const [values, setValues] = useState({
    fullName: '',
    email: initialIdentifier || '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [fastAuthBusy, setFastAuthBusy] = useState(null);
  const router = useRouter();
  const session = useSession();
  const { profiles, remove } = useDeviceProfiles();

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

    const identifier = values.email.trim();
    const errors = {};

    let identifierError = null;
    if (identifier.includes('@')) {
      identifierError = validateEmail(identifier);
    } else if (identifier.length < 3) {
      identifierError = 'Enter your email or username (at least 3 characters).';
    }
    if (identifierError) errors.email = identifierError;
    const passwordError = validatePassword(values.password);
    if (passwordError) errors.password = passwordError;

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiPost('/api/auth/login', {
        identifier,
        password: values.password,
      });
      // Remember email+password so a later "Save Credentials & Logout" can keep
      // them on this device for one-tap sign-in.
      rememberPassword(data.user.email, values.password);
      completeAuth(data);
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
      rememberPassword(data.user.email, values.password);
      completeAuth(data);
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
      clearRememberedPassword();
      completeAuth(data);
    } catch (err) {
      setFieldErrors(err.fieldErrors || {});
      setAuthError(err.message || 'Google sign-in failed.');
      setLoading(false);
    }
  }

  function completeAuth(data) {
    persistAuthSession({
      user: data.user,
      token: data.token,
      refreshToken: data.refreshToken,
      isNewUser: data.isNewUser,
    });
    router.push(data.isNewUser ? '/onboarding?isNewUser=true' : '/dashboard');
  }

  function handleSubmit(e) {
    if (isSignIn) {
      return handleSignIn(e);
    }
    return handleSignup(e);
  }

  const canFastAuth = (profile) =>
    profile.hasSavedCredentials && !profile.credentialsInvalid;

  async function handleSavedProfileTap(profile) {
    if (!canFastAuth(profile)) {
      // "Logout Only" card: keep the profile visible but require a password.
      setValues((prev) => ({ ...prev, email: profile.username || profile.email }));
      setTab(TABS.SIGN_IN);
      setFieldErrors({});
      setAuthError('');
      return;
    }
    setFastAuthBusy(profile.userId);
    try {
      await session.fastAuth(profile);
      router.replace('/dashboard');
    } catch (err) {
      setAuthError(err.message || 'One-tap sign-in failed. Enter your password to continue.');
      setFastAuthBusy(null);
    }
  }

  function handleForgetDevice(userId, e) {
    e.stopPropagation();
    remove(userId);
  }

  const content = (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--luna-bg)] px-4 py-12">
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
          className="w-full rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-white/5 sm:p-8"
        >
          {/* Mobile brand header */}
          <div className="mb-8 lg:hidden">
            <h1 className="text-center text-3xl font-bold lowercase tracking-tight text-gray-900 dark:text-white">
              luna
            </h1>
            <p className="mt-1 text-center text-sm font-light tracking-wide text-gray-500 dark:text-gray-400">
              a new light on conversation
            </p>
          </div>

          {/* Saved profiles list (tap to login / forget device) */}
          {profiles.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Saved accounts
              </p>
              <ul className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {profiles.map((profile) => {
                  const busy = fastAuthBusy === profile.userId;
                  const fast = canFastAuth(profile);
                  return (
                    <li key={profile.userId} className="shrink-0">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        disabled={busy}
                        onClick={() => handleSavedProfileTap(profile)}
                        className="group relative flex items-center gap-2 rounded-2xl border border-gray-200 bg-[var(--luna-surface-2)] py-1.5 pl-1.5 pr-3 text-left transition hover:border-[#7C3AED]/60 dark:border-white/10 dark:bg-gray-800/60 disabled:opacity-70"
                      >
                        {profile.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C3AED]/40 text-sm font-bold text-white">
                            {profile.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="min-w-0">
                          <span className="block max-w-[7rem] truncate text-xs font-semibold text-gray-900 dark:text-white">
                            {profile.displayName}
                          </span>
                          <span className="block text-[10px] text-gray-500 dark:text-gray-400">
                            {fast ? (
                              <span className="inline-flex items-center gap-0.5 text-[#7C3AED]">
                                <Zap className="h-2.5 w-2.5" /> Tap to login
                              </span>
                            ) : (
                              'Password required'
                            )}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Forget ${profile.displayName} on this device`}
                          title="Forget this device"
                          onClick={(e) => handleForgetDevice(profile.userId, e)}
                          className="rounded-full p-1 text-gray-400 transition hover:bg-[#EF4444]/15 hover:text-[#F87171]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {busy && (
                          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60 dark:bg-black/40">
                            <Loader2 className="h-4 w-4 animate-spin text-[#7C3AED]" />
                          </span>
                        )}
                      </motion.button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Tab switcher — Sign In / Create Account only */}
          <div className="relative mb-6 grid grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/80">
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
              const label =
                value === TABS.SIGN_IN ? 'Sign In' : 'Create Account';
              const active = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchTab(value)}
                  className={`relative z-10 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
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
            {contextProfile && tab === TABS.SIGN_IN && (
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-[var(--luna-surface-2)] p-3 dark:border-white/10 dark:bg-gray-800/60">
                {contextProfile.avatarUrl ? (
                  <img
                    src={contextProfile.avatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED]/40 font-bold text-white">
                    {contextProfile.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    Signing in as {contextProfile.displayName}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    @{contextProfile.username} · password required
                  </p>
                </div>
              </div>
            )}

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
                    placeholder="Email or username"
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
                <div className="flex items-center justify-end text-sm">
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className="text-[#A78BFA] transition hover:text-[#C4B5FD]"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-70"
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
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                or continue with
              </span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

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
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-[var(--luna-surface-2)] px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-[#7C3AED]/50 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200 disabled:cursor-not-allowed disabled:opacity-70"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-[var(--luna-surface-2)] px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-[#7C3AED]/50 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200"
              >
                <GoogleIcon className="h-4 w-4" />
                Continue with Google
              </button>
            )}

            {/* Apple Sign-In (coming soon) */}
            <button
              type="button"
              onClick={() =>
                setAuthError('Apple Sign-In is coming soon. Use email or Google for now.')
              }
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-[var(--luna-surface-2)] px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-[#7C3AED]/50 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200"
            >
              <AppleIcon className="h-4 w-4" />
              Continue with Apple
            </button>
          </motion.div>

          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            By continuing you agree to Luna&apos;s terms &amp; privacy policy.
          </p>
        </motion.div>
      </div>

      {/* Theme toggle, visible on the auth screen */}
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
    </main>
  );

  if (!GOOGLE_CLIENT_ID) {
    return content;
  }

  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{content}</GoogleOAuthProvider>;
}