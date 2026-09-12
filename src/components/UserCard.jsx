'use client';

import { motion } from 'framer-motion';
import { Loader2, UserCheck, UserMinus, X } from 'lucide-react';
import Avatar from '@/components/Avatar';

/**
 * A single person card in the suggestions grid. `status` drives the primary
 * action:
 *  - 'idle'       -> Add Friend + Ignore
 *  - 'sending'    -> spinner on the Add button
 *  - 'sent'       -> the two buttons change into ONE "Cancel Request" button
 *  - 'cancelling' -> spinner on that Cancel Request button
 */
export default function UserCard({ user, status = 'idle', onAdd, onIgnore, onCancel }) {
  const busy = status === 'sending';
  const sent = status === 'sent';
  const cancelling = status === 'cancelling';

  return (
    <motion.div
      layout
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex items-center gap-3">
        <Avatar name={user.name} src={user.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {user.name}
          </p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {user.username ? `@${user.username}` : user.email}
          </p>
        </div>
      </div>

      {sent || cancelling ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-[var(--luna-surface-2)] px-3 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {cancelling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {cancelling ? 'Cancelling…' : 'Cancel Request'}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAdd}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:bg-[#7C3AED]/40 disabled:text-white/70"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            {busy ? 'Sending…' : 'Add Friend'}
          </button>

          <button
            type="button"
            onClick={onIgnore}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-[var(--luna-surface-2)] px-3 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={`Ignore ${user.name}`}
          >
            <UserMinus className="h-4 w-4" />
            Ignore
          </button>
        </div>
      )}
    </motion.div>
  );
}