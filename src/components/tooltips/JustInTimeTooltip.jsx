'use client';

import { motion } from 'framer-motion';
import { X, Lightbulb } from 'lucide-react';

/**
 * Just-In-Time Tooltip — a small callout rendered next to a UI control the
 * first time the user interacts with a related surface. Managed by
 * `useJustInTimeTooltips`; dismissing marks it seen forever.
 *
 * @param {object} props
 * @param {import('@/lib/tooltips').TooltipMeta} props.meta
 * @param {() => void} props.onDismiss
 * @param {'top'|'bottom'|'left'|'right'} [props.place='bottom'] - rough placement
 */
export default function JustInTimeTooltip({ meta, onDismiss, place = 'bottom' }) {
  const placement =
    place === 'top'
      ? 'bottom-full mb-2'
      : place === 'bottom'
        ? 'top-full mt-2'
        : place === 'left'
          ? 'right-full mr-2'
          : 'left-full ml-2';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`pointer-events-auto absolute z-30 w-56 rounded-2xl border border-[#7C3AED]/30 bg-[#1F2937] p-3 shadow-2xl ${placement}`}
    >
      <button
        type="button"
        aria-label="Got it"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded-md p-0.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-2 pr-5">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#FBBF24]" />
        <div>
          <p className="text-xs font-bold text-white">{meta.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-300">{meta.body}</p>
        </div>
      </div>
    </motion.div>
  );
}