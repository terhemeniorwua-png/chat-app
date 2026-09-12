'use client';

import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

/**
 * Accessible Light/Dark toggle. Rendered in the auth screens and the main app
 * shell; every instance shares the same global ThemeContext state.
 * @param {object} props
 * @param {string} [props.className]
 * @param {'button'|'pill'} [props.variant='button']
 */
export default function ThemeToggle({ className = '', variant = 'button' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`relative inline-flex h-6 w-11 items-center rounded-full bg-[#7C3AED] transition ${className}`}
      >
        <motion.span
          aria-hidden="true"
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={`flex h-4 w-4 items-center justify-center rounded-full bg-white shadow ${
            isDark ? 'translate-x-6' : 'translate-x-1'
          }`}
        >
          {isDark ? <Moon className="h-2.5 w-2.5 text-[#7C3AED]" /> : <Sun className="h-2.5 w-2.5 text-[#F59E0B]" />}
        </motion.span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--luna-border)] bg-[var(--luna-surface)] text-[var(--luna-muted)] transition hover:border-[#7C3AED]/50 hover:text-[#7C3AED] ${className}`}
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}