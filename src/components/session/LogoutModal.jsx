'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, LogOut, X } from 'lucide-react';

/**
 * LogoutModal — the mandatory credential-save prompt shown on session
 * termination. The user's choice decides the whole device-persistence branch:
 *   YES ("Save Credentials & Logout") → email, password and refresh token are
 *         vaulted on the device profile → next tap on the profile card signs
 *         straight in (one-tap, no prompts).
 *   NO  ("Logout Only") → only profile metadata (userId/displayName/username/
 *         avatarUrl) survives; every token and credential is purged → the card
 *         stays on the login screen but re-prompts for a password.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} [props.avatarUrl]
 * @param {string} [props.displayName]
 * @param {string} [props.username]
 * @param {boolean} [props.busy]
 * @param {() => void} props.onClose
 * @param {(saveCredentials: boolean) => void} props.onConfirm
 */
export default function LogoutModal({
  open,
  avatarUrl,
  displayName,
  username,
  busy = false,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1F2937] sm:p-7"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EF4444]/15 text-[#F87171]">
                <LogOut className="h-5 w-5" />
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h2 id="logout-title" className="mt-4 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Sign out of Luna?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              Do you want to save your credentials on this device for one-tap
              sign-in next time?
            </p>

            {displayName && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-[var(--luna-surface-2)] p-3 dark:border-white/10 dark:bg-white/5">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED]/30 text-sm font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {displayName}
                  </p>
                  {username && (
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">@{username}</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 space-y-2.5">
              <motion.button
                type="button"
                disabled={busy}
                whileTap={{ scale: 0.98 }}
                onClick={() => onConfirm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/30 transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                Save Credentials &amp; Logout
              </motion.button>

              <button
                type="button"
                disabled={busy}
                onClick={() => onConfirm(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-[var(--luna-surface-2)] px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Logout Only
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="w-full rounded-xl px-4 py-2 text-xs font-medium text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-500 dark:text-gray-600">
              Choosing &ldquo;Logout Only&rdquo; keeps your profile card for easy pick-up next
              time, but clears all tokens and credentials from this device.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}