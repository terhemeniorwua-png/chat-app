'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMetadataStorage } from '@/lib/secureStorage';

export const THEME_STORAGE_KEY = 'luna.theme.v1';

/**
 * @typedef {'light'|'dark'} ThemeMode
 * @typedef {Object} ThemeContextValue
 * @property {ThemeMode} theme
 * @property {() => void} toggleTheme
 * @property {(mode: ThemeMode) => void} setTheme
 */

/** @type {import('react').Context<ThemeContextValue|null>} */
const ThemeContext = createContext(null);

/**
 * Resolves the starting theme: previously-saved preference over the OS-level
 * preference, over the light default.
 * @returns {ThemeMode}
 */
function readInitialTheme() {
  try {
    const saved = getMetadataStorage().getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable (SSR) — fall through */
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

/**
 * Global Light/Dark theme manager. Persists the user's choice in localStorage
 * (survives reloads and app-wide logouts), applies the `.dark` class to
 * <html>, and keeps every mount site in sync via context.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      getMetadataStorage().setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  const setTheme = useCallback((mode) => {
    setThemeState(mode === 'dark' ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** @returns {ThemeContextValue} */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return ctx;
}