'use client';

import { motion } from 'framer-motion';
import { Sparkles, Sticker, MessagesSquare, Users } from 'lucide-react';

/**
 * Interactive System Bot (empty-state) banner. Shown to zero-contact users on
 * top of the chat list: it introduces the seeded "Luna Welcome Bot" thread and
 * offers instant-starter chips so messaging/sticker-testing is one tap away.
 *
 * @param {object} props
 * @param {() => void} props.onStartThread - select the system-bot thread.
 * @param {() => void} props.onFindFriends - jump to contact discovery.
 * @param {boolean} [props.systemBotActive=false] - thread already selected.
 */
export default function OnboardingBotBanner({
  onStartThread,
  onFindFriends,
  systemBotActive = false,
}) {
  const suggestions = [
    { label: 'Say hello', icon: MessagesSquare, onClick: onStartThread },
    { label: 'Try a sticker', icon: Sticker, onClick: onStartThread },
    { label: 'Find a friend', icon: Users, onClick: onFindFriends },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mx-3 mt-2 rounded-2xl border border-[#7C3AED]/30 bg-gradient-to-br from-[#7C3AED]/20 to-[#F59E0B]/10 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#F59E0B] to-[#FBBF24] shadow-md">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7C3AED]">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">Your welcome thread is ready</p>
            <span className="rounded-full bg-[#10B981]/20 px-2 py-0.5 text-[10px] font-semibold text-[#34D399]">
              new
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-300">
            The <span className="font-semibold text-[#C4B5FD]">Luna Welcome Bot</span> is
            waiting for you — send a message or a sticker to see how it feels.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {suggestions.map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                type="button"
                disabled={systemBotActive && label !== 'Find a friend'}
                onClick={onClick}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-default disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}