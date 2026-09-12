'use client';

import { motion } from 'framer-motion';
import { UserPlus, AlertTriangle, Zap, X } from 'lucide-react';
import BrandMark from '@/components/BrandMark';

/**
 * Login view rendering saved local profiles from localStorage.
 *
 *  - A profile with `hasSavedCredentials && !credentialsInvalid` renders the
 *    fast-auth card — "Tap to Login as [Profile]" — no credential entry needed.
 *  - A profile whose saved credential failed validation renders the same card
 *    with an "Sign-in required" badge; selecting it routes to the password
 *    prompt with the visual profile kept intact.
 *  - Everything else is the plain account picker (select → password).
 *  - Each card has an "X" (Forget Device) button that removes the saved
 *    profile/credentials from this device.
 *
 * @param {object} props
 * @param {import('@/lib/constants').StoredProfile[]} props.profiles
 * @param {(profile: import('@/lib/constants').StoredProfile) => void} props.onSelect
 * @param {() => void} props.onAddNew
 * @param {(userId: string) => void} [props.onRemove] - forget a saved account from this device
 * @param {string|null} [props.busyUserId] - shows a spinner on the tapped card
 */
export default function AccountPickerScreen({
  profiles,
  onSelect,
  onAddNew,
  onRemove,
  busyUserId = null,
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--luna-bg)] px-4 py-12">
      {/* Ambient gradient backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#7C3AED]/25 blur-[110px]" />
        <div className="absolute -bottom-32 -right-28 h-96 w-96 rounded-full bg-[#F59E0B]/15 blur-[130px]" />
      </div>

      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-white/5 sm:p-8"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandMark scoped size="md" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Choose an account to continue.
            </p>
          </div>

          {profiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No saved accounts found on this device.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {profiles.map((profile) => {
                const isBusy = busyUserId === profile.userId;
                const fastAuth = profile.hasSavedCredentials && !profile.credentialsInvalid;
                return (
                  <li key={profile.userId}>
                    <motion.div
                      whileTap={isBusy ? false : { scale: 0.98 }}
                      className={`group relative flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-[var(--luna-surface-2)] p-3 text-left transition dark:border-white/10 dark:bg-gray-800/60 ${
                        isBusy ? 'opacity-70' : 'cursor-pointer hover:border-[#7C3AED]/60'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onSelect(profile)}
                        aria-label={`Sign in as ${profile.displayName}`}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        {profile.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7C3AED]/40 text-lg font-bold text-white">
                            {profile.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {profile.displayName}
                            </p>
                            {fastAuth && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#7C3AED]/25 px-2 py-0.5 text-[10px] font-semibold text-[#C4B5FD]">
                                <Zap className="h-2.5 w-2.5" />
                                Tap to login
                              </span>
                            )}
                            {profile.credentialsInvalid && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#F59E0B]/20 px-2 py-0.5 text-[10px] font-semibold text-[#FBBF24]">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Sign-in required
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            @{profile.username}
                            {profile.hasSavedCredentials && !fastAuth && ' · password required'}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        aria-label={`Forget ${profile.displayName} on this device`}
                        title="Forget Device"
                        onClick={() => onRemove?.(profile.userId)}
                        className="shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-[#EF4444]/15 hover:text-[#F87171]"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      {isBusy && (
                        <span className="absolute right-12 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#7C3AED] border-t-transparent" />
                      )}
                    </motion.div>
                  </li>
                );
              })}
            </ul>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={onAddNew}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#7C3AED]/50 bg-[#7C3AED]/15 px-4 py-3 text-sm font-semibold text-[#7C3AED] transition hover:bg-[#7C3AED]/25 dark:text-[#C4B5FD]"
          >
            <UserPlus className="h-4 w-4" />
            Add New Account
          </motion.button>

          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            By continuing you agree to Luna&apos;s terms &amp; privacy policy.
          </p>
        </motion.div>
      </div>
    </main>
  );
}