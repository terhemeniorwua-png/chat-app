'use client';

import { motion } from 'framer-motion';
import { Loader2, UserCheck, X } from 'lucide-react';
import Avatar from '@/components/Avatar';

/**
 * An incoming friend request row. `busy` is 'accept' | 'decline' | null while
 * an action is in flight so both buttons disable together.
 */
export default function RequestCard({ request, busy, onAccept, onDecline }) {
  const { sender } = request;

  return (
    <motion.div
      layout
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={sender.name} src={sender.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {sender.name}
          </p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {sender.username ? `@${sender.username}` : sender.email}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={Boolean(busy)}
          className="flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'accept' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          Accept
        </button>

        <button
          type="button"
          onClick={onDecline}
          disabled={Boolean(busy)}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-[var(--luna-surface-2)] px-3 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {busy === 'decline' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          Decline
        </button>
      </div>
    </motion.div>
  );
}