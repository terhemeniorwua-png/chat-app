'use client';

import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle2, CloudOff } from 'lucide-react';

const LABELS = {
  idle: null,
  syncing: 'Syncing messages…',
  synced: 'All caught up',
  offline: 'Offline — retrying',
};

/**
 * Sync State Indicator — a non-blocking header status pill shown while the
 * background catch-up (re-engagement) is in flight. It never captures the
 * pointer; the user can keep browsing the chat list underneath.
 *
 * @param {object} props
 * @param {import('@/lib/reengagement').SyncStatus} props.status
 */
export default function SyncStateIndicator({ status }) {
  const label = LABELS[status];
  if (!label) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center justify-center gap-2 border-b border-gray-100 bg-[#F3F4F6] px-4 py-1.5"
    >
      {status === 'syncing' && (
        <RefreshCw className="h-3 w-3 animate-spin text-[#7C3AED]" />
      )}
      {status === 'synced' && <CheckCircle2 className="h-3 w-3 text-[#10B981]" />}
      {status === 'offline' && <CloudOff className="h-3 w-3 text-amber-500" />}

      <span
        className={`text-xs font-medium ${
          status === 'offline' ? 'text-amber-600' : status === 'synced' ? 'text-[#047857]' : 'text-gray-600'
        }`}
      >
        {label}
      </span>
    </motion.div>
  );
}