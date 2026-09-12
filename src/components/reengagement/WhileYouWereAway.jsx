'use client';

import { motion } from 'framer-motion';
import { Pin, AtSign, MessageSquareText } from 'lucide-react';

const KIND_META = {
  mention: { icon: AtSign, label: 'Mention', color: 'bg-blue-500/15 text-blue-600' },
  pinned: { icon: Pin, label: 'Pinned', color: 'bg-amber-500/15 text-amber-600' },
  unread: { icon: MessageSquareText, label: 'Unread', color: 'bg-[#7C3AED]/15 text-[#7C3AED]' },
};

/**
 * "While You Were Away" feed — pinned messages, direct @mentions, and unread
 * badges surfaced above the chat list for returning users.
 *
 * @param {object} props
 * @param {import('@/lib/reengagement').ReengagementItem[]} props.items
 * @param {(threadId: string) => void} props.onOpenThread
 */
export default function WhileYouWereAway({ items, onOpenThread }) {
  if (!items.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="border-b border-gray-100 bg-gradient-to-r from-[#7C3AED]/10 via-white to-[#F59E0B]/10 px-4 py-3"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        While you were away
      </p>
      <div className="space-y-1.5">
        {items.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenThread(item.threadId)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/80"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-gray-900">{item.threadName}</span>
                    <span className="text-[10px] font-medium uppercase text-gray-400">{meta.label}</span>
                  </span>
                  {item.badge ? (
                    <span className="shrink-0 rounded-full bg-[#7C3AED] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-gray-500">{item.snippet}</span>
              </span>
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}