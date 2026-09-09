'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';

/**
 * Timing map for the splash sequence (all values in seconds). The math is
 * deliberately kept linear and auditable:
 *
 *   1. intro        : content scales/fades in            0.0s - 0.6s
 *   2. pre-glow hold: beat before the first pulse      0.6s - 0.8s
 *   3. glow         : two full pulses of the halo      0.8s - 2.2s
 *   4. settle       : breathe before the exit fade     2.2s - 2.3s
 *
 * `onComplete` fires at the end of the settle; AnimatePresence in the parent
 * then plays the 0.6s exit fade (OUTRO_DURATION), so the total time on stage
 * is ~2.9s and there is no doubled fade-out.
 */
const INTRO_DURATION = 0.6;
const PRE_GLOW_HOLD = 0.2;
const PULSE_DURATION = 0.7;
const GLOW_PULSES = 2;
const SETTLE = 0.1;
const OUTRO_DURATION = 0.6;

const GLOW_DURATION = PULSE_DURATION * GLOW_PULSES;

const TOTAL_MS = Math.round(
  (INTRO_DURATION + PRE_GLOW_HOLD + GLOW_DURATION + SETTLE) * 1000
);

/**
 * Two full pulse cycles on a single normalized timeline: the keyframe arrays
 * below alternate 1 -> 1.5 -> 1 -> 1.5 -> 1 (twice the `times` steps), and the
 * `times` array spreads each cycle across GLOW_DURATION equally.
 */
const GLOW_SCALE = Array.from({ length: GLOW_PULSES * 2 + 1 }, (_, i) =>
  i % 2 === 0 ? 1 : 1.5
);
const GLOW_OPACITY = Array.from({ length: GLOW_PULSES * 2 + 1 }, (_, i) =>
  i % 2 === 0 ? 0.3 : 1
);
const GLOW_TIMES = Array.from(
  { length: GLOW_PULSES * 2 + 1 },
  (_, i) => i / (GLOW_PULSES * 2)
);

/**
 * The first screen a visitor sees: the Luna mark (orange moon wrapping a
 * purple speech bubble with the paper plane) over an ambient glow that pulses
 * twice before handing off to the auth gateway.
 *
 * @param {object} props
 * @param {() => void} props.onComplete - called after the settle; the parent
 *   should remove this component to trigger the exit fade.
 */
export default function SplashScreen({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, TOTAL_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#1F2937]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: OUTRO_DURATION, ease: 'easeInOut' } }}
    >
      {/*
        Halo pulse behind the mark. Starts after the intro and the pre-glow
        hold, completes two full cycles, then holds at scale 1 / opacity 0.3
        during the settle.
      */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute h-[11rem] w-[11rem] rounded-full bg-[#F59E0B]/40 blur-xl"
        initial={{ scale: 1, opacity: 0.3 }}
        animate={{
          scale: GLOW_SCALE,
          opacity: GLOW_OPACITY,
          transition: {
            delay: INTRO_DURATION + PRE_GLOW_HOLD,
            duration: GLOW_DURATION,
            times: GLOW_TIMES,
            ease: 'easeInOut',
          },
        }}
      />

      {/*
        Content block scales in (0.5 -> 1) and fades up over the intro window,
        then rides along with the glow behind it.
      */}
      <motion.div
        className="relative flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{
          opacity: 1,
          scale: 1,
          transition: {
            duration: INTRO_DURATION,
            ease: [0.16, 1, 0.3, 1],
          },
        }}
      >
        <div className="relative">
          {/* Warm orange crescent moon */}
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-tr from-[#F59E0B] to-[#FBBF24] shadow-[0_0_2.5rem_rgba(245,158,11,0.5)]">
            {/* Overlapping purple speech bubble with the paper plane */}
            <div className="-translate-x-1.5 -translate-y-1 flex h-16 w-16 items-center justify-center rounded-2xl rounded-tl-md bg-[#7C3AED] shadow-[0_10px_35px_rgba(124,58,237,0.65)]">
              <Send className="-rotate-12 h-7 w-7 fill-white text-white" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <h1 className="mt-8 text-5xl font-bold lowercase tracking-tight text-white">
          luna
        </h1>
        <p className="mt-2 text-base font-light tracking-wide text-white/60">
          a new light on conversation
        </p>
      </motion.div>
    </motion.div>
  );
}