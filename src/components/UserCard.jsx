'use client';

import { motion } from 'framer-motion';
import { Loader2, Plus, UserCheck, UserMinus } from 'lucide-react';
import Avatar from '@/components/Avatar';

/**
 * A single person card in the suggestions grid. `status` drives the primary
 * action: 'idle' (Add Friend), 'sending' (spinner), or 'sent' (disabled).
 */
export default function UserCard({ user, status = 'idle', onAdd, onIgnore }) {
  const busy = status === 'sending';
  const sent = status === 'sent';

  return (
    <motion.div
      layout
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <Avatar name={user.name} src={user.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="truncate text-xs text-gray-400">{user.email}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={busy || sent}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:bg-[#7C3AED]/40 disabled:text-white/70"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sent ? (
            <UserCheck className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {busy ? 'Sending…' : sent ? 'Request Sent' : 'Add Friend'}
        </button>

        <button
          type="button"
          onClick={onIgnore}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed"
          aria-label={`Ignore ${user.name}`}
        >
          <UserMinus className="h-4 w-4" />
          Ignore
        </button>
      </div>
    </motion.div>
  );
}