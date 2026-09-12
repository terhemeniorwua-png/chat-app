'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UserRound, CheckCircle2, Circle, ChevronDown, Camera, AlignLeft, Smile } from 'lucide-react';

const STEP_ICONS = { photo: Camera, bio: AlignLeft, status: Smile };

/**
 * Progressive Profile Setup — a subtle, non-blocking completion tracker
 * (photo, bio, status) rendered as a pill inside the main chat view. Expanding
 * it lists the outstanding steps; it never blocks messaging.
 *
 * @param {object} props
 * @param {import('@/lib/profileProgress').ProfileProgress} props.progress
 */
export default function ProfileProgressTracker({ progress }) {
  const [open, setOpen] = useState(false);
  const doneCount = progress.steps.filter((s) => s.done).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          progress.percent === 100
            ? 'border-[#10B981]/40 bg-[#10B981]/10 text-[#047857] hover:bg-[#10B981]/20'
            : 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#92400E] hover:bg-[#F59E0B]/20'
        }`}
      >
        <UserRound className="h-3.5 w-3.5" />
        {progress.percent === 100 ? `${doneCount}/${doneCount} done` : `Set up your profile · ${progress.summary}`}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl"
          >
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Finish your profile
            </p>
            <ul className="mt-2 space-y-1">
              {progress.steps.map((step) => {
                const Icon = STEP_ICONS[step.id];
                return (
                  <li key={step.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-gray-300" />
                    )}
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${step.done ? 'text-[#10B981]' : 'text-gray-400'}`} />
                    <span
                      className={`text-xs font-medium ${
                        step.done
                          ? 'text-gray-400 line-through'
                          : 'text-gray-700 hover:text-[#6D28D9]'
                      }`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#F59E0B]"
                initial={{ width: 0 }}
                animate={{ width: `${progress.percent}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}