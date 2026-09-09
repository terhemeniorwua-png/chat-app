'use client';

import { Send } from 'lucide-react';

const SIZE_STYLES = {
  sm: {
    container: 'gap-2',
    moon: 'h-16 w-16',
    plane: 'h-3 w-3',
    planeOffset: '-left-2 -top-1.5',
    aura: '-inset-5',
    title: 'text-3xl',
    subtitle: 'text-xs',
  },
  md: {
    container: 'gap-3',
    moon: 'h-20 w-20',
    plane: 'h-4 w-4',
    planeOffset: '-left-3 -top-2',
    aura: '-inset-6',
    title: 'text-4xl',
    subtitle: 'text-sm',
  },
  lg: {
    container: 'gap-4',
    moon: 'h-32 w-32',
    plane: 'h-6 w-6',
    planeOffset: '-left-4 -top-3',
    aura: '-inset-8',
    title: 'text-5xl',
    subtitle: 'text-base',
  },
};

/**
 * Reusable Luna brand lockup: a warm-orange crescent moon that carries an
 * overlapping purple speech bubble whose paper plane ("Send") embodies "a new
 * light on conversation."
 *
 * @param {object} props
 * @param {boolean} [props.scoped=false] - omit the outer glow aura (used inside cards).
 * @param {('sm'|'md'|'lg')} [props.size='md'] - visual scale of the lockup.
 */
export default function BrandMark({ scoped = false, size = 'md' }) {
  const styles = SIZE_STYLES[size] || SIZE_STYLES.md;

  return (
    <div className={`flex flex-col items-center ${styles.container}`}>
      <div className="relative flex items-center justify-center">
        {scoped ? null : (
          <div
            aria-hidden="true"
            className={`absolute ${styles.aura} rounded-full bg-[#F59E0B]/50 blur-xl`}
          />
        )}

        <div
          className={`relative flex ${styles.moon} items-center justify-center`}
        >
          <svg
            viewBox="0 0 48 48"
            aria-hidden="true"
            className="h-full w-full"
            fill="none"
          >
            <defs>
              <linearGradient id="luna-crescent" x1="8" y1="4" x2="42" y2="42">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>

            <circle cx="26" cy="24" r="17" fill="#F59E0B" />
            <circle cx="21" cy="19" r="17" fill="url(#luna-crescent)" />
            <circle cx="20" cy="18" r="16.5" fill="#1F2937" />

            <circle cx="31" cy="26" r="12" fill="#7C3AED" />
            <path
              d="M19 26V22.5A2.5 2.5 0 0 1 21.5 20h9A2.5 2.5 0 0 1 33 22.5V26a2.5 2.5 0 0 1-2.5 2.5h-5.8l-3.9 3.2c-.6.5-1.5 0-1.5-.7V26Z"
              fill="#7C3AED"
            />
            <path
              d="M19.4 22.8 27 27a1.4 1.4 0 0 0 1.9-.6L33 20"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <span className={`relative ${styles.planeOffset}`}>
            <Send
              className={`${styles.plane} text-white`}
              strokeWidth={2.5}
            />
          </span>
        </div>
      </div>

      <div className="text-center">
        <h1
          className={`${styles.title} font-bold lowercase tracking-tight text-white`}
        >
          luna
        </h1>
        <p
          className={`mt-1 ${styles.subtitle} font-light tracking-wide text-gray-400`}
        >
          a new light on conversation
        </p>
      </div>
    </div>
  );
}