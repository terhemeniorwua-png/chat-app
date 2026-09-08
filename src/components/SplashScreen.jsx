'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';

/**
 * Timing map for the splash sequence (all values in seconds).
 * Encode the phases up top so the math is easy to audit and tweak:
 *
 *   1. intro  : scale/opacity entrance            0.0s - 0.6s
 *   2. glow   : two full glow cycles with a 0.2s 0.6s - 3.2s
 *               settle before the first pulse
 *   3. outro  : graceful fade-out then `onComplete` 3.2s - 3.8s
 */
const INTRO_DURATION = 0.6;
const GLOW_CYCLE_DURATION = 1.2;
const GLOW_PULSES = 2;
const PRE_GLOW_HOLD = 0.2;
const OUTRO_DURATION = 0.6;

const TOTAL_MS = Math.round(
  (INTRO_DURATION +
    PRE_GLOW_HOLD +
    GLOW_CYCLE_DURATION * GLOW_PULSES +
    OUTRO_DURATION) *
    1000
);

/**
 * Builds the keyframe arrays for two full glow cycles.
 *
 * The specified `scale: [1, 1.45, 1, 1.45, 1]` and `opacity: [0.2, 0.95, ...]`
 * maps to a single-timescale `times` array that evenly distributes each
 * cycle-keyframe (including both peak values) across the whole sequence, so
 * every full cycle completes within its slot.
 */
function buildGlowTiming(cycleDuration, pulses) {
  const seconds = [0];
  for (let p = 0; p < pulses; p++) {
    const cycleStart = seconds[seconds.length - 1];
    seconds.push(
      cycleStart + cycleDuration * 0.45,
      cycleStart + cycleDuration * 0.7,
      cycleStart + cycleDuration * 0.95,
      cycleStart + cycleDuration
    );
  }
  return seconds;
}

const glowTimes = buildGlowTiming(GLOW_CYCLE_DURATION, GLOW_PULSES);

const glowScale = Array.from({ length: 1 + glowTimes.slice(1).length }, (_, i) =>
  i === 0 ? 1 : i % 4 === 1 ? 1.45 : i % 4 === 2 ? 1 : i % 4 === 3 ? 1.45 : 1
);

const glowOpacity = Array.from(
  { length: 1 + glowTimes.slice(1).length },
  (_, i) =>
    i === 0 || i % 4 === 0 ? 0.2 : i % 4 === 1 ? 0.95 : i % 4 === 2 ? 0.2 : 0.95
);

/**
 * The first screen a visitor sees.
 *
 * @param {object} props
 * @param {() => void} props.onComplete - called after the outro completes.
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
        Ghost glow ring that sits behind the orange moon. Fires two full
        pulse cycles via the keyframes above, starting after the intro settles.
      */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute h-[11rem] w-[11rem] rounded-full bg-[#F59E0B]/50 blur-xl"
        initial={{ scale: 1, opacity: 0.2 }}
        animate={{
          scale: glowScale,
          opacity: glowOpacity,
          transition: {
            delay: INTRO_DURATION + PRE_GLOW_HOLD,
            duration: GLOW_CYCLE_DURATION * GLOW_PULSES,
            times: glowTimes.map(
              (t) =>
                (INTRO_DURATION + PRE_GLOW_HOLD + t * (1 / (glowTimes.length - 1))) /
                3.4
            ),
            ease: 'easeInOut',
          },
        }}
      />

      {/*
        Content block scales in (0.5 -> 1) and fades up over the intro window.
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