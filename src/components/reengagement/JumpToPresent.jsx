'use client';

import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

/**
 * "Jump to Present" — the floating pill ChatThread shows when the user has
 * scrolled away from the bottom of the thread. Clicking it snaps back to the
 * newest message (and marks the thread read). Also doubles as a first-unread
 * nudge: while the user is in the past, the pill shows the unread count.
 *
 * @param {object} props
 * @param {number} props.unread - messages left unread at the current position.
 * @param {() => void} props.onJump - snap to present.
 */
export default function JumpToPresent({ unread, onJump }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      onClick={onJump}
      className="pointer-events-auto fixed bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#7C3AED]/40 transition hover:bg-[#6D28D9] sm:left-auto sm:right-6 sm:translate-x-0"
    >
      <span className="flex items-center gap-1.5">
        {unread > 0 ? (
          <>
            <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px]">{unread}</span>
            new messages
          </>
        ) : (
          'Jump to present'
        )}
        <ArrowDown className="h-3.5 w-3.5" />
      </span>
    </motion.button>
  );
}